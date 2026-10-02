import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { homePrivilege, signInWith } from '../access/sign-in.test-helper';
import { layouts, setLayout, tableSkeleton } from '../table-skeleton.test-helper';
import { useReportDataset } from '../reports/report-dataset.resource';
import { waitingListRows } from '../waiting-list/waiting-list.fixture';
import WaitingList from '../waiting-list/waiting-list.component';
import WaitingListSummary from './waiting-list-summary.component';

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

const [emergent, urgent, elective] = [
  '1fe15210-4490-58b0-a38c-bb0386e98482',
  '33bf504a-15f2-5504-9bdc-ddded0b5eb00',
  '2666bf97-7400-57c7-b535-7903e22ced34',
];

function row(id: string, urgency: string, concept: string, dateAdded: string) {
  return {
    ...waitingListRows[0],
    rhd_id: id,
    recommendation_uuid: id,
    urgency,
    urgency_concept: concept,
    date_added: dateAdded,
  };
}

const rows = [
  row('rhd00001', '3: elective (180 days/6 months)', elective, '2026-09-24'),
  row('rhd00002', '2: urgent (60 days/2 months)', urgent, '2026-07-20'),
  row('rhd00003', '1: emergent (24 hours)', emergent, '2026-09-28'),
  row('rhd00004', '3: elective (180 days/6 months)', elective, '2026-08-01'),
  row('rhd00005', '1: emergent (24 hours)', emergent, '2026-09-19'),
  row('rhd00006', '2: urgent (60 days/2 months)', urgent, '2026-09-14'),
  row('rhd00007', '3: elective (180 days/6 months)', elective, '2026-09-28'),
];

function ids() {
  return screen
    .getAllByRole('row')
    .slice(1)
    .map((tr) => within(tr).getAllByRole('cell')[0].textContent);
}

describe('ACT home procedural waiting list summary', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 29, 10), toFake: ['Date'] });
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    window.history.replaceState(null, '', '/openmrs/spa/home/act-home');
    await signInWith([homePrivilege, 'View Patient Flags']);
  });

  afterEach(() => vi.useRealTimers());

  it('shows the five most urgent open recommendations, overdue first, in the order the page lists them', () => {
    dataset({ rows });

    const { unmount } = render(<WaitingListSummary />);
    const summary = ids();
    unmount();
    render(<WaitingList />);
    const page = ids();

    expect(summary).toEqual(['rhd00005', 'rhd00002', 'rhd00003', 'rhd00006', 'rhd00004']);
    expect(summary).toEqual(page.slice(0, 5));
  });

  it("shows each row's ACT ID, type, procedure, urgency and days pending, and marks the overdue ones", () => {
    dataset({ rows });

    render(<WaitingListSummary />);

    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'ACT ID',
      'Type',
      'Procedure',
      'Urgency',
      'Days pending',
    ]);
    const first = screen.getAllByRole('row')[1];
    expect(
      within(first)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['rhd00005', 'Catheterization', 'Mitral balloon valvuloplasty', '1: Emergent', '10']);
    expect(
      screen
        .getAllByRole('row')
        .slice(1)
        .map((tr) => tr.getAttribute('data-overdue')),
    ).toEqual(['true', 'true', 'false', 'false', 'false']);
  });

  it('evaluates the waiting list report the page uses', () => {
    dataset({ rows });

    render(<WaitingListSummary />);

    expect(mockUseReportDataset).toHaveBeenLastCalledWith('5b0f1c2e-9d3a-4c1b-8f6e-2a7d9e4b3c10');
  });

  it("names a band configured without a short label by its label, and one with neither by the report's name", async () => {
    await signInWith([homePrivilege, 'View Patient Flags'], {
      urgencyBands: [
        { label: 'Emergent', concept: emergent, deadlineDays: 1 },
        { concept: urgent, deadlineDays: 60 },
      ],
    });
    dataset({ rows: [rows[4], rows[5]] });

    render(<WaitingListSummary />);

    const urgencies = screen
      .getAllByRole('row')
      .slice(1)
      .map((tr) => within(tr).getAllByRole('cell')[3].textContent);
    expect(urgencies).toEqual(['Emergent', '2: urgent (60 days/2 months)']);
  });

  it('links to the full waiting list', () => {
    dataset({ rows });

    render(<WaitingListSummary />);

    expect(screen.getByRole('link', { name: /open/i })).toHaveAttribute('href', '/openmrs/spa/home/act-waiting-list');
  });

  it('says so when no recommendation is waiting', () => {
    dataset({ rows: [] });

    render(<WaitingListSummary />);

    expect(screen.getByTestId('table-empty-state')).toHaveTextContent(
      'There are no procedural recommendations to display',
    );
  });

  it('says so when the report cannot be evaluated', () => {
    dataset({ error: new Error('Server responded with 404') });

    render(<WaitingListSummary />);

    expect(screen.getByText('Could not load the procedural waiting list')).toBeInTheDocument();
  });

  it.each(layouts)(
    'loads as a table skeleton of its five rows, sized as its table on $layout',
    ({ layout, compact, size }) => {
      setLayout(layout);
      dataset({ isLoading: true });
      const { rerender } = render(<WaitingListSummary />);

      const { skeleton, rows, columns } = tableSkeleton();
      expect({ rows, columns }).toEqual({ rows: 5, columns: 5 });
      expect(skeleton.className.includes('cds--data-table--compact')).toBe(compact);
      dataset({ rows: waitingListRows });
      rerender(<WaitingListSummary />);
      expect(screen.getByRole('table')).toHaveClass(`cds--data-table--${size}`);
    },
  );

  it('is hidden from a user without the waiting list privilege', async () => {
    await signInWith([homePrivilege], { screenPrivileges: { waitingList: 'App: act.waitingList' } as never });
    dataset({ rows });

    render(<WaitingListSummary />);

    expect(screen.queryByText(/procedural waiting list/i)).not.toBeInTheDocument();
  });
});
