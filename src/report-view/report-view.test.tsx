import React from 'react';
import dayjs from 'dayjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getDefaultsFromConfigSchema } from '@openmrs/esm-framework';
import { type Config, configSchema } from '../config-schema';
import { signInWith } from '../access/sign-in.test-helper';
import { type ClinicLimit, useClinicLimit } from '../clinic-limit';
import { useReportDataset } from '../reports/report-dataset.resource';
import ReportView from './report-view.component';

vi.mock('../reports/report-dataset.resource', () => ({ useReportDataset: vi.fn() }));
vi.mock('../clinic-limit', () => ({ useClinicLimit: vi.fn() }));
vi.mock('../act-page-header/act-page-header.component', () => ({
  ActPageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
const csv = vi.hoisted(() => ({ props: undefined as undefined | Record<string, never> }));
vi.mock('../table-filters/download-csv-button.component', () => ({
  DownloadCsvButton: (props: never) => {
    csv.props = props;
    return <button type="button">Download CSV</button>;
  },
}));

const columns = [
  { name: 'rhd_id', label: 'rhd_id', datatype: 'java.lang.String' },
  { name: 'location', label: 'location', datatype: 'java.lang.String' },
  { name: 'encounter_count', label: 'encounter_count', datatype: 'java.lang.Integer' },
];
const rows = [
  { rhd_id: 'rhd00002', location: 'Gulu RRH', encounter_count: 10 },
  { rhd_id: 'rhd00001', location: 'Gulu RRH', encounter_count: 9 },
  { rhd_id: 'rhd00003', location: 'Lira RRH', encounter_count: 2 },
];

const visitsReport = () => (getDefaultsFromConfigSchema(configSchema) as Config).reportCatalogue[0];
const limitTo = (limit: ClinicLimit) => vi.mocked(useClinicLimit).mockReturnValue(limit);
function dataset(value: Partial<ReturnType<typeof useReportDataset>> = {}) {
  vi.mocked(useReportDataset).mockReturnValue({
    columns,
    rows,
    isLoading: false,
    error: undefined,
    mutate: vi.fn(),
    ...value,
  });
}
const bodyIds = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0].textContent);
const csvRows = async () =>
  (await (csv.props as never as { rows: () => Array<Array<string>> }).rows()).map((r) => r[0]);

describe('ReportView', () => {
  beforeEach(async () => {
    vi.mocked(useReportDataset).mockReset();
    dataset();
    limitTo({ status: 'none' });
    await signInWith(['App: act.reports']);
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    window.history.replaceState({}, '', `/home/act-report?report=${visitsReport().id}`);
  });

  it('shows the chosen report as a table with a header for each column of its dataset', () => {
    render(<ReportView />);

    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      expect.stringMatching(/Rhd id$/),
      expect.stringMatching(/Location$/),
      expect.stringMatching(/Encounter count$/),
    ]);
    expect(bodyIds()).toEqual(['rhd00002', 'rhd00001', 'rhd00003']);
    expect(vi.mocked(useReportDataset).mock.calls[0][0]).toBe(visitsReport().report);
  });

  it('sorts by a header, numbers as numbers, ascending then descending', async () => {
    const user = userEvent.setup();
    render(<ReportView />);

    await user.click(screen.getByRole('button', { name: /Encounter count/ }));
    expect(bodyIds()).toEqual(['rhd00003', 'rhd00001', 'rhd00002']);
    await user.click(screen.getByRole('button', { name: /Encounter count/ }));
    expect(bodyIds()).toEqual(['rhd00002', 'rhd00001', 'rhd00003']);
  });

  it('narrows the rows by a search of any column, and the CSV holds those rows in the order shown', async () => {
    const user = userEvent.setup();
    render(<ReportView />);

    await user.click(screen.getByRole('button', { name: /Rhd id/ }));
    await user.type(screen.getByRole('searchbox'), 'gulu');

    expect(bodyIds()).toEqual(['rhd00001', 'rhd00002']);
    expect(await csvRows()).toEqual(['rhd00001', 'rhd00002']);
    expect(csv.props).toMatchObject({ identifiers: true, list: 'report:Visits' });
  });

  it('holds a user limited to clinics to the rows of their clinics', async () => {
    limitTo({ status: 'ready', uuids: ['g'], names: ['Lira RRH'] });

    render(<ReportView />);

    expect(bodyIds()).toEqual(['rhd00003']);
  });

  it('says so when the report has no rows, and when it cannot be loaded', () => {
    dataset({ rows: [], columns: [] });
    const { unmount } = render(<ReportView />);
    expect(screen.getByTestId('table-empty-state')).toBeInTheDocument();
    unmount();

    dataset({ error: new Error('boom') });
    render(<ReportView />);
    expect(screen.getByText('Could not load the report')).toBeInTheDocument();
  });

  it('asks the dataset for plain YYYY-MM-DD dates, twelve months back to today by default', () => {
    render(<ReportView />);

    expect(vi.mocked(useReportDataset).mock.calls[0][1]).toEqual({
      startDate: dayjs().subtract(12, 'month').format('YYYY-MM-DD'),
      endDate: dayjs().format('YYYY-MM-DD'),
    });
  });

  it('runs no report while the end is before the start, and says so', () => {
    render(<ReportView />);
    vi.mocked(useReportDataset).mockClear();

    fireEvent.change(screen.getByLabelText('To'), {
      target: { value: dayjs().subtract(2, 'year').format('YYYY-MM-DD') },
    });

    expect(screen.getByText('The end is before the start')).toBeInTheDocument();
    expect(vi.mocked(useReportDataset).mock.calls.at(-1)?.[0]).toBeNull();
  });

  it('disables the CSV download when no rows are visible, and logs whether a search applied, not its words', async () => {
    const user = userEvent.setup();
    render(<ReportView />);
    expect(csv.props).toMatchObject({ disabled: false, filters: { searched: 'no' } });

    await user.type(screen.getByRole('searchbox'), 'Jane Doe');

    expect(screen.getByText('No rows match the search')).toBeInTheDocument();
    expect(csv.props).toMatchObject({ disabled: true, filters: { searched: 'yes' } });
    expect(JSON.stringify(csv.props?.filters)).not.toContain('Jane');
  });

  it('says so for a report that is not in the catalogue', () => {
    window.history.replaceState({}, '', '/home/act-report?report=nope');

    render(<ReportView />);

    expect(screen.getByText('There is no such report')).toBeInTheDocument();
    expect(vi.mocked(useReportDataset).mock.calls.every(([report]) => report === null)).toBe(true);
  });
});
