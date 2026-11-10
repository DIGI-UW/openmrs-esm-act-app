import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { openmrsFetch } from '@openmrs/esm-framework';
import { atSessionLocation, signInWith } from '../access/sign-in.test-helper';
import { columnHeaders } from '../column-headers.test-helper';
import { layouts, setLayout, tableSkeleton } from '../table-skeleton.test-helper';
import { useReportDataset } from '../reports/report-dataset.resource';
import { screenPositiveRows } from './screen-positive.fixture';
import ScreenPositive from './screen-positive.component';

// Who may record a form is may-enter-form's own test; here every form may be recorded.
vi.mock('../access/may-enter-form', () => ({
  MayEnterForm: ({ children }: { children: React.ReactNode }) => children,
  useMayEnterForm: () => true,
}));
vi.mock('../reports/report-dataset.resource', () => ({ useReportDataset: vi.fn() }));
// The stylesheet's class names, so a test can tell the tag drawn yellow.
vi.mock('./screen-positive.scss', () => ({ default: { notContacted: 'notContacted' } }));
const mockUseReportDataset = vi.mocked(useReportDataset);

function dataset(value: Partial<ReturnType<typeof useReportDataset>>) {
  mockUseReportDataset.mockReturnValue({
    columns: [],
    rows: [],
    isLoading: false,
    error: undefined,
    mutate: vi.fn(),
    ...value,
  });
}

function shownNames() {
  return screen.getAllByRole('link').map((link) => link.textContent);
}

function options(label: string) {
  return within(screen.getByLabelText(label))
    .getAllByRole('option')
    .map((option) => option.textContent);
}

describe('Diagnosis to confirm', () => {
  beforeEach(async () => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    window.history.replaceState(null, '', '/openmrs/spa/home/act-screen-positive');
    await signInWith(['App: act.screenPositive', 'Add Encounters']);
  });

  it('names the list for what takes a patient off it', () => {
    dataset({ rows: screenPositiveRows });

    render(<ScreenPositive />);

    expect(screen.getByRole('heading', { name: 'Diagnosis to confirm' })).toBeInTheDocument();
    expect(screen.getByText(/Record diagnosis opens their form beside this list/)).toBeInTheDocument();
  });

  it('lists each patient with their age and sex, the date of positive screen and screening site', () => {
    dataset({ rows: screenPositiveRows });

    render(<ScreenPositive />);

    expect(columnHeaders()).toEqual(['Patient', 'Screened', 'Screening site', '']);
    const cells = within(screen.getByRole('row', { name: /Patient 2\b/ }))
      .getAllByRole('cell')
      .map((cell) => cell.textContent);
    expect(cells).toEqual(['Patient 2rhd00002 · 9 M', '17-Sept-2026', 'Layibi College', 'Record diagnosis']);
  });

  it('sorts by any column, the date of positive screen by its day, then returns to the report order', async () => {
    dataset({
      rows: [
        { ...screenPositiveRows[0], screen_date: '2026-09-17' },
        { ...screenPositiveRows[1], screen_date: '2026-10-02' },
        { ...screenPositiveRows[2], screen_date: '2026-01-05' },
      ],
    });
    render(<ScreenPositive />);
    const sortBy = (header: string) => userEvent.click(screen.getByRole('button', { name: new RegExp(`^${header}`) }));

    await sortBy('Screened');
    expect(shownNames().filter((name) => name.startsWith('Patient'))).toEqual(['Patient 3', 'Patient 1', 'Patient 2']);
    await sortBy('Screened');
    expect(shownNames().filter((name) => name.startsWith('Patient'))).toEqual(['Patient 2', 'Patient 1', 'Patient 3']);
    await sortBy('Screened');
    expect(shownNames().filter((name) => name.startsWith('Patient'))).toEqual(['Patient 1', 'Patient 2', 'Patient 3']);
  });

  it("opens on the patients of the session's primary care clinic", async () => {
    dataset({ rows: screenPositiveRows });
    atSessionLocation('Anyeke HCIV', ['RHD Community']);

    render(<ScreenPositive />);

    await waitFor(() => expect(screen.getByLabelText('Primary care clinic')).toHaveValue('Anyeke HCIV'));
    const atClinic = screenPositiveRows.filter((row) => row.primary_care_clinic === 'Anyeke HCIV');
    const names = atClinic.map((row) => row.full_name);
    expect(shownNames().filter((name) => !names.includes(name))).toEqual([]);
    expect(screen.getByText(new RegExp(`of ${atClinic.length} items`))).toBeInTheDocument();
  });

  it("says it could not load, rather than every clinic's patients, when the session location's kind cannot be read", async () => {
    dataset({ rows: screenPositiveRows });
    atSessionLocation('Anyeke HCIV', ['RHD Community'], 'unreadable-screen-positive');
    vi.mocked(openmrsFetch).mockRejectedValue(new Error('Internal Server Error'));

    render(<ScreenPositive />);

    expect(await screen.findByText('Could not load the screen positive list')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('leaves the site empty for a patient with none recorded', () => {
    dataset({ rows: screenPositiveRows });

    render(<ScreenPositive />);

    const cells = within(screen.getByRole('row', { name: /Patient 4\b/ })).getAllByRole('cell');
    expect(cells[2]).toHaveTextContent('');
  });

  it("links each patient's name to their chart, with the ACT ID, age and sex beneath it", () => {
    dataset({ rows: screenPositiveRows });

    render(<ScreenPositive />);

    expect(screen.getByRole('link', { name: 'Patient 2' })).toHaveAttribute(
      'href',
      '/openmrs/spa/patient/patient-2/chart',
    );
    const patientCell = within(screen.getByRole('row', { name: /rhd00002\b/ })).getAllByRole('cell')[0];
    expect(patientCell).toHaveTextContent(/^Patient 2rhd00002 · 9 M$/);
    expect(within(patientCell).getByRole('link', { name: 'Patient 2' })).toBeInTheDocument();
  });

  it('evaluates the configured report', () => {
    dataset({ rows: screenPositiveRows });

    render(<ScreenPositive />);

    expect(mockUseReportDataset).toHaveBeenLastCalledWith('e3b8f7a2-6c41-4d9e-8a57-1f0c2d4b9e63');
  });

  it('offers the cardiac clinic and sex filters the values the patients have', () => {
    dataset({ rows: screenPositiveRows });

    render(<ScreenPositive />);

    expect(options('Cardiac clinic')).toEqual(['All', 'Gulu RRH', 'Lira RRH']);
    expect(options('Sex')).toEqual(['All', 'F', 'M']);
  });

  it('narrows the patients to the chosen cardiac clinic and sex, and keeps them in the URL', async () => {
    dataset({ rows: screenPositiveRows.slice(0, 6) });

    render(<ScreenPositive />);
    await userEvent.selectOptions(screen.getByLabelText('Cardiac clinic'), 'Gulu RRH');
    await userEvent.selectOptions(screen.getByLabelText('Sex'), 'M');

    expect(shownNames()).toEqual(['Patient 2', 'Patient 6']);
    await waitFor(() => expect(new URLSearchParams(window.location.search).get('cardiac')).toBe('Gulu RRH'));
    expect(new URLSearchParams(window.location.search).get('sex')).toBe('M');
  });

  it('restores the filters from the URL', () => {
    window.history.replaceState(null, '', '/openmrs/spa/home/act-screen-positive?cardiac=Lira+RRH&sex=F');
    dataset({ rows: screenPositiveRows.slice(0, 6) });

    render(<ScreenPositive />);

    expect(shownNames()).toEqual(['Patient 1']);
  });

  it('says so when no patient matches the filters', async () => {
    window.history.replaceState(null, '', '/openmrs/spa/home/act-screen-positive?cardiac=Lira+RRH&sex=Other');
    dataset({ rows: screenPositiveRows.slice(0, 6) });

    render(<ScreenPositive />);

    expect(screen.getByTestId('filter-empty-state')).toHaveTextContent('No patients to displayCheck the filters above');
  });

  it('shows the patients a page at a time', async () => {
    dataset({ rows: screenPositiveRows });

    render(<ScreenPositive />);

    expect(screen.getAllByRole('row')).toHaveLength(1 + 10);
    await userEvent.click(screen.getByRole('button', { name: /next page/i }));
    expect(screen.getByText(/11–20 of 30 items/)).toBeInTheDocument();
  });

  it('says so when no patient is waiting for a diagnosis', () => {
    dataset({ rows: [] });

    render(<ScreenPositive />);

    expect(screen.getByTestId('table-empty-state')).toHaveTextContent(
      'There are no screen positive patients waiting for a diagnosis',
    );
  });

  it('says so when the report cannot be loaded', () => {
    dataset({ error: new Error('Server responded with 404') });

    render(<ScreenPositive />);

    expect(screen.getByText('Could not load the screen positive list')).toBeInTheDocument();
  });

  it.each(layouts)(
    'loads as a table skeleton of a page of rows, sized as its table on $layout',
    ({ layout, compact, size }) => {
      setLayout(layout);
      dataset({ isLoading: true });
      const { rerender } = render(<ScreenPositive />);

      const { skeleton, rows, columns } = tableSkeleton();
      expect({ rows, columns }).toEqual({ rows: 10, columns: 4 });
      expect(skeleton.className.includes('cds--data-table--compact')).toBe(compact);
      dataset({ rows: screenPositiveRows });
      rerender(<ScreenPositive />);
      expect(screen.getByRole('table')).toHaveClass(`cds--data-table--${size}`);
    },
  );
});
