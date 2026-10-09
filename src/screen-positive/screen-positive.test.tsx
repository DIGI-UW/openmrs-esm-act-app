import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { signInWith } from '../access/sign-in.test-helper';
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

function shownIds() {
  const headers = screen.getAllByRole('columnheader').map((header) => header.textContent);
  return screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[headers.indexOf('ACT ID')].textContent);
}

function options(label: string) {
  return within(screen.getByLabelText(label))
    .getAllByRole('option')
    .map((option) => option.textContent);
}

describe('Confirmatory echo due', () => {
  beforeEach(async () => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    window.history.replaceState(null, '', '/openmrs/spa/home/act-screen-positive');
    await signInWith(['App: act.screenPositive', 'Add Encounters']);
  });

  it("lists each patient's ACT ID, name, age, sex, clinics and date of positive screen", () => {
    dataset({ rows: screenPositiveRows });

    render(<ScreenPositive />);

    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent);
    expect(headers).toEqual([
      'ACT ID',
      'Name',
      'Age',
      'Sex',
      'Cardiac clinic',
      'Primary care clinic',
      'Date of positive screen',
      '',
    ]);
    const cells = within(screen.getByRole('row', { name: /rhd00002\b/ }))
      .getAllByRole('cell')
      .map((cell) => cell.textContent);
    expect(cells).toEqual([
      'rhd00002',
      'Patient 2',
      '9',
      'M',
      'Gulu RRH',
      'Anyeke HCIV',
      '17-Sept-2026',
      'Enter diagnosis',
    ]);
  });

  it("links each patient's name to their chart", () => {
    dataset({ rows: screenPositiveRows });

    render(<ScreenPositive />);

    expect(screen.getByRole('link', { name: 'Patient 2' })).toHaveAttribute(
      'href',
      '/openmrs/spa/patient/patient-2/chart',
    );
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

    expect(shownIds()).toEqual(['rhd00002', 'rhd00006']);
    await waitFor(() => expect(new URLSearchParams(window.location.search).get('cardiac')).toBe('Gulu RRH'));
    expect(new URLSearchParams(window.location.search).get('sex')).toBe('M');
  });

  it('restores the filters from the URL', () => {
    window.history.replaceState(null, '', '/openmrs/spa/home/act-screen-positive?cardiac=Lira+RRH&sex=F');
    dataset({ rows: screenPositiveRows.slice(0, 6) });

    render(<ScreenPositive />);

    expect(shownIds()).toEqual(['rhd00001']);
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
      expect({ rows, columns }).toEqual({ rows: 10, columns: 8 });
      expect(skeleton.className.includes('cds--data-table--compact')).toBe(compact);
      dataset({ rows: screenPositiveRows });
      rerender(<ScreenPositive />);
      expect(screen.getByRole('table')).toHaveClass(`cds--data-table--${size}`);
    },
  );
});
