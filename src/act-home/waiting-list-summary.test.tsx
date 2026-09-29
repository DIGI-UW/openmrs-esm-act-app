import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { homePrivilege, signInWith } from '../access/sign-in.test-helper';
import { useReportDataset } from '../reports/report-dataset.resource';
import { waitingListRows } from '../waiting-list/waiting-list.fixture';
import WaitingList from '../waiting-list/waiting-list.component';
import WaitingListSummary from './waiting-list-summary.component';

vi.mock('../reports/report-dataset.resource', () => ({ useReportDataset: vi.fn() }));
const mockUseReportDataset = vi.mocked(useReportDataset);

function dataset(value: Partial<ReturnType<typeof useReportDataset>>) {
  mockUseReportDataset.mockReturnValue({ columns: [], rows: [], isLoading: false, error: undefined, ...value });
}

const [week, month, threeMonths] = [
  '406285f2-be72-5594-8664-c8568ad9bc88',
  '82c5209b-c183-5bc9-941c-890eba821a44',
  '925610f9-1c3c-5396-880f-02a5fe309d53',
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

// On 2026-09-29: two overdue (a week band 10 days old, a month band 40 days old), then the rest by band and age.
const rows = [
  row('rhd00001', '3 - within 3 months', threeMonths, '2026-09-24'),
  row('rhd00002', '2 - within 1 month', month, '2026-08-20'),
  row('rhd00003', '1 - within 1 week', week, '2026-09-26'),
  row('rhd00004', '3 - within 3 months', threeMonths, '2026-08-01'),
  row('rhd00005', '1 - within 1 week', week, '2026-09-19'),
  row('rhd00006', '2 - within 1 month', month, '2026-09-14'),
  row('rhd00007', '3 - within 3 months', threeMonths, '2026-09-28'),
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
    ).toEqual(['rhd00005', 'Catheterization', 'Mitral balloon valvuloplasty', '1 - within 1 week', '10']);
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

  it('links to the full waiting list', () => {
    dataset({ rows });

    render(<WaitingListSummary />);

    expect(screen.getByRole('link', { name: /open/i })).toHaveAttribute('href', '/openmrs/spa/home/act-waiting-list');
  });

  it('says so when no recommendation is waiting', () => {
    dataset({ rows: [] });

    render(<WaitingListSummary />);

    expect(screen.getByText('No procedural recommendations are waiting.')).toBeInTheDocument();
  });

  it('says so when the report cannot be evaluated', () => {
    dataset({ error: new Error('Server responded with 404') });

    render(<WaitingListSummary />);

    expect(screen.getByText('Could not load the procedural waiting list')).toBeInTheDocument();
  });

  it('shows a placeholder while the report runs', () => {
    dataset({ isLoading: true });

    render(<WaitingListSummary />);

    expect(screen.getByTestId('waiting-list-summary-loading')).toBeInTheDocument();
  });

  it('is hidden from a user without the waiting list privilege', async () => {
    await signInWith([homePrivilege], { screenPrivileges: { waitingList: 'App: act.waitingList' } as never });
    dataset({ rows });

    render(<WaitingListSummary />);

    expect(screen.queryByText(/procedural waiting list/i)).not.toBeInTheDocument();
  });
});
