import React from 'react';
import dayjs from 'dayjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { signInWith } from '../access/sign-in.test-helper';
import { useReportDataset } from '../reports/report-dataset.resource';
import { useRegistryByFacility } from './studies.resource';
import Studies from './studies.component';

vi.mock('../reports/report-dataset.resource', () => ({ useReportDataset: vi.fn() }));
vi.mock('./studies.resource', () => ({ useRegistryByFacility: vi.fn() }));

const rows = [
  {
    facility: 'Akunalaber HCIII',
    facility_uuid: 'akunalaber',
    active_patients: 12,
    due_this_week: 3,
    overdue: 2,
    bpg_on_time: 8,
    bpg_timed: 10,
  },
  {
    facility: 'Anyeke HCIV',
    facility_uuid: 'anyeke',
    active_patients: 5,
    due_this_week: 1,
    overdue: 4,
    bpg_on_time: 1,
    bpg_timed: 2,
  },
];

const facilityRows = [
  { facility: 'Akunalaber HCIII', patients: 12, adherence: 91.4 },
  { facility: 'Anyeke HCIV', patients: 5, adherence: 72 },
  { facility: null, patients: 2, adherence: null },
];

function dataset(value: Partial<ReturnType<typeof useReportDataset>> = {}) {
  vi.mocked(useReportDataset).mockReturnValue({
    columns: [],
    rows,
    isLoading: false,
    error: undefined,
    mutate: vi.fn(),
    ...value,
  });
}

function facilities(value: Partial<ReturnType<typeof useRegistryByFacility>> = {}) {
  vi.mocked(useRegistryByFacility).mockReturnValue({
    rows: facilityRows,
    isLoading: false,
    error: undefined,
    ...value,
  });
}

const tile = (label: string) => screen.getAllByTestId('studies-tile').find((t) => t.textContent.startsWith(label));

describe('Studies', () => {
  beforeEach(async () => {
    await signInWith(['Manage Locations']);
    vi.mocked(useReportDataset).mockReset();
    vi.mocked(useRegistryByFacility).mockReset();
    dataset();
    facilities();
  });

  it("totals the facilities' rows from the programme report in the KPI tiles", () => {
    render(<Studies />);

    expect(screen.getByRole('heading', { name: 'Studies' })).toBeInTheDocument();

    const tiles = screen.getAllByTestId('studies-tile');
    expect(tiles).toHaveLength(4);
    expect(tile('Active patients')).toHaveTextContent('Active patients17');
    expect(tile('Due this week')).toHaveTextContent('Due this week4');
    expect(tile('Overdue')).toHaveTextContent('Overdue6');
    // 9 of 12 timed injections on time.
    expect(tile('BPG on-time rate')).toHaveTextContent('BPG on-time rate75%');
  });

  it('shows no rate when no injection in the period was timed', () => {
    dataset({ rows: [{ ...rows[0], bpg_on_time: 0, bpg_timed: 0 }, { ...rows[1], bpg_on_time: 0, bpg_timed: 0 }] });

    render(<Studies />);

    expect(tile('BPG on-time rate')).toHaveTextContent('BPG on-time rate–');
  });

  it('shows loading skeletons in every tile while the report is loading', () => {
    dataset({ rows: [], isLoading: true });

    render(<Studies />);

    const tiles = screen.getAllByTestId('studies-tile');
    tiles.forEach((t) => expect(within(t).queryByText(/^\d/)).not.toBeInTheDocument());
  });

  it('shows an error notification when the report cannot be loaded', () => {
    dataset({ rows: [], error: new Error('boom') });

    render(<Studies />);

    expect(screen.getByText('Could not load the report')).toBeInTheDocument();
    expect(screen.queryAllByTestId('studies-tile')).toHaveLength(0);
  });

  it('runs the programme report over the current month', () => {
    render(<Studies />);

    const [, params] = vi.mocked(useReportDataset).mock.calls.at(-1);
    expect(params.startDate).toBe(dayjs().startOf('month').format('YYYY-MM-DD'));
    expect(params.endDate).toBe(dayjs().endOf('month').format('YYYY-MM-DD'));
  });

  it('shows a By facility table with the facility, active patient count and mean adherence from the rollup', () => {
    render(<Studies />);

    expect(screen.getByText('By facility')).toBeInTheDocument();
    const table = screen.getByRole('table');
    const tableRows = within(table).getAllByRole('row');
    // Header row + three rollup rows.
    expect(tableRows).toHaveLength(4);
    expect(within(tableRows[1]).getByText('Akunalaber HCIII')).toBeInTheDocument();
    expect(within(tableRows[1]).getByText('12 active')).toBeInTheDocument();
    expect(within(tableRows[1]).getByText('91%')).toBeInTheDocument();
    expect(within(tableRows[2]).getByText('Anyeke HCIV')).toBeInTheDocument();
    expect(within(tableRows[2]).getByText('72%')).toBeInTheDocument();
    expect(within(tableRows[3]).getByText('No facility')).toBeInTheDocument();
    expect(within(tableRows[3]).getByText('–')).toBeInTheDocument();
  });

  it('shows an error notification when the facility rollup cannot be loaded', () => {
    facilities({ rows: [], error: new Error('boom') });

    render(<Studies />);

    expect(screen.getByText('Could not load the facility rollup')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
