import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { navigate } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { layouts, setLayout, tableSkeleton } from '../table-skeleton.test-helper';
import { useReportDataset } from '../reports/report-dataset.resource';
import { registryRows } from './registry.fixture';
import Registry from './registry.component';
import { columnHeaders } from '../column-headers.test-helper';

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

const registryPrivilege = 'App: act.registry';

describe('Registry', () => {
  beforeEach(async () => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    // An explicit All, so every row shows, rather than the opening defaults.
    window.history.replaceState(null, '', '/openmrs/spa/home/act-registry?status=');
    await signInWith([registryPrivilege]);
  });

  it("lists the report's patients with their name above their ACT ID, age and sex, diagnosis and prophylaxis", () => {
    dataset({ rows: registryRows });

    render(<Registry />);

    const headers = columnHeaders();
    expect(headers).toEqual(['', 'Patient', 'Age, sex', 'Diagnosis', 'Prophylaxis', 'Flags']);
    const first = screen.getByRole('row', { name: /Patient 1\b/ });
    expect(
      within(first)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['', 'Patient 1rhd00001', '10 F', 'RHD A', 'Q28 day BPG', '']);
    const [, patient] = within(first).getAllByRole('cell');
    expect(within(patient).getByRole('link', { name: 'Patient 1' })).toHaveAttribute(
      'href',
      '/openmrs/spa/patient/patient-1/chart',
    );
  });

  it('shows only the age or the sex a patient has, and an empty cell for neither', () => {
    const [first, second, third] = registryRows;
    dataset({
      rows: [
        { ...first, sex: null },
        { ...second, age_years: null },
        { ...third, age_years: null, sex: null },
      ],
    });

    render(<Registry />);

    const ageSex = (name: RegExp) => within(screen.getByRole('row', { name })).getAllByRole('cell')[2].textContent;
    expect(ageSex(/Patient 1\b/)).toBe('10');
    expect(ageSex(/Patient 2\b/)).toBe('M');
    expect(ageSex(/Patient 3\b/)).toBe('');
  });

  it('evaluates the configured report over every enrolment up to today', () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 29, 10) });
    dataset({ rows: registryRows });

    render(<Registry />);

    vi.useRealTimers();
    expect(mockUseReportDataset).toHaveBeenLastCalledWith('f1a2b3c4-d5e6-7890-abcd-ef1234567890', {
      startDate: '1900-01-01',
      endDate: '2026-09-29',
    });
  });

  it('shows the patients ten to a page, offering 10, 25, 50 and 100', async () => {
    dataset({ rows: registryRows });

    render(<Registry />);

    expect(screen.getAllByRole('row')).toHaveLength(1 + 10);
    expect(screen.getByLabelText(/items per page/i)).toHaveValue('10');
    expect(
      within(screen.getByLabelText(/items per page/i))
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['10', '25', '50', '100']);
    await userEvent.click(screen.getByRole('button', { name: /next page/i }));
    expect(screen.getAllByRole('row')).toHaveLength(1 + 10);
    expect(screen.getByRole('row', { name: /Patient 11\b/ })).toBeInTheDocument();
  });

  it("opens a patient's chart from their row", async () => {
    dataset({ rows: registryRows });

    render(<Registry />);

    await userEvent.click(screen.getByRole('row', { name: /Patient 2\b/ }));
    expect(vi.mocked(navigate)).toHaveBeenCalledWith({ to: '${openmrsSpaBase}/patient/patient-2/chart' });
  });

  it('offers larger pages, and shows as many rows as the page size chosen', async () => {
    dataset({ rows: registryRows });

    render(<Registry />);

    await userEvent.selectOptions(screen.getByLabelText(/items per page/i), '50');
    expect(screen.getAllByRole('row')).toHaveLength(1 + 30);
  });

  it("opens a patient's chart once when their name is clicked", async () => {
    dataset({ rows: registryRows });

    render(<Registry />);

    await userEvent.click(screen.getByRole('link', { name: 'Patient 2' }));
    expect(vi.mocked(navigate)).toHaveBeenCalledTimes(0);
  });

  it("links each patient's name to their chart, for keyboard and new-tab use", () => {
    dataset({ rows: registryRows });

    render(<Registry />);

    expect(screen.getByRole('link', { name: 'Patient 2' })).toHaveAttribute(
      'href',
      '/openmrs/spa/patient/patient-2/chart',
    );
  });

  it('says so when no patient is enrolled', () => {
    dataset({ rows: [] });

    render(<Registry />);

    expect(screen.getByTestId('table-empty-state')).toHaveTextContent('There are no registry patients to display');
  });

  it('says so when the report cannot be loaded', () => {
    dataset({ error: new Error('Server responded with 404') });

    render(<Registry />);

    expect(screen.getByText('Could not load the registry')).toBeInTheDocument();
  });

  it.each(layouts)(
    'loads as a table skeleton of a page of rows, sized as its table on $layout',
    ({ layout, compact, size }) => {
      setLayout(layout);
      dataset({ isLoading: true });
      const { rerender } = render(<Registry />);

      const { skeleton, rows, columns } = tableSkeleton();
      expect({ rows, columns }).toEqual({ rows: 10, columns: 5 });
      expect(skeleton.className.includes('cds--data-table--compact')).toBe(compact);
      dataset({ rows: registryRows });
      rerender(<Registry />);
      expect(screen.getByRole('table')).toHaveClass(`cds--data-table--${size}`);
    },
  );
});
