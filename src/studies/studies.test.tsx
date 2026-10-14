import React from 'react';
import dayjs from 'dayjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { signInWith } from '../access/sign-in.test-helper';
import { useReportDataset } from '../reports/report-dataset.resource';
import Studies from './studies.component';

vi.mock('../reports/report-dataset.resource', () => ({ useReportDataset: vi.fn() }));

const rows = [
  {
    facility: 'Akunalaber HCIII',
    facility_uuid: 'akunalaber',
    active_patients: 12,
    due_this_week: 3,
    overdue: 2,
    bpg_on_time: 8,
    bpg_timed: 10,
    adherence: 91,
    data_tag: 'Complete',
  },
  {
    facility: 'Anyeke HCIV',
    facility_uuid: 'anyeke',
    active_patients: 5,
    due_this_week: 1,
    overdue: 4,
    bpg_on_time: 1,
    bpg_timed: 2,
    adherence: 72,
    data_tag: 'Duplicates',
  },
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

const tile = (label: string) => screen.getAllByTestId('studies-tile').find((t) => t.textContent.startsWith(label));

describe('Studies', () => {
  beforeEach(async () => {
    await signInWith(['Manage Locations']);
    vi.mocked(useReportDataset).mockReset();
    dataset();
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
    dataset({
      rows: [
        { ...rows[0], bpg_on_time: 0, bpg_timed: 0 },
        { ...rows[1], bpg_on_time: 0, bpg_timed: 0 },
      ],
    });

    render(<Studies />);

    expect(tile('BPG on-time rate')).toHaveTextContent('BPG on-time rate–');
  });

  it('shows loading skeletons in every tile while the report is loading', () => {
    dataset({ rows: [], isLoading: true });

    render(<Studies />);

    const tiles = screen.getAllByTestId('studies-tile');
    tiles.forEach((t) => expect(within(t).queryByText(/^\d/)).not.toBeInTheDocument());
  });

  it('shows an error notification and nothing else when the report cannot be loaded', () => {
    dataset({ rows: [], error: new Error('boom') });

    render(<Studies />);

    expect(screen.getByText('Could not load the report')).toBeInTheDocument();
    expect(screen.queryAllByTestId('studies-tile')).toHaveLength(0);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('runs the programme report over the current month', () => {
    render(<Studies />);

    const [, params] = vi.mocked(useReportDataset).mock.calls.at(-1);
    expect(params.startDate).toBe(dayjs().startOf('month').format('YYYY-MM-DD'));
    expect(params.endDate).toBe(dayjs().endOf('month').format('YYYY-MM-DD'));
  });

  it("shows a By facility table listing each programme-report row's facility, active patients, adherence and data tag, as Reports does", () => {
    render(<Studies />);

    expect(screen.getByText('By facility')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Facility', 'Patients', 'Adherence', 'Data']);
    expect(
      within(table)
        .getAllByRole('row')
        .slice(1)
        .map((row) =>
          within(row)
            .getAllByRole('cell')
            .map((cell) => cell.textContent),
        ),
    ).toEqual([
      ['Akunalaber HCIII', '12 active', '91%', 'Complete'],
      ['Anyeke HCIV', '5 active', '72%', 'Duplicates'],
    ]);
  });

  it('says there are no active patients when the report has no rows for the month', () => {
    dataset({ rows: [] });

    render(<Studies />);

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('There are no active patients')).toBeInTheDocument();
  });
});
