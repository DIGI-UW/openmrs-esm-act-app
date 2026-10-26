import React from 'react';
import dayjs from 'dayjs';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { formatDatetime, openmrsFetch, showSnackbar } from '@openmrs/esm-framework';
import { RunChartSnapshotTile } from './run-chart-snapshot-tile.component';
import { type RunChartRun, type RunChartRuns } from './run-chart-snapshot.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const day = (back: number) => dayjs().subtract(back, 'day').format('YYYY-MM-DD');
const run = (back: number, overrides: Partial<RunChartRun> = {}): RunChartRun => ({
  runDate: day(back),
  finished: dayjs().subtract(back, 'day').startOf('day').add(2, 'hour').add(5, 'minute').toISOString(),
  durationMillis: 38000,
  source: 'scheduled',
  status: 'taken',
  rows: 61,
  clinics: 60,
  reason: null,
  ...overrides,
});

function backendAnswers(runs: RunChartRuns, snapshot: () => Promise<unknown> = vi.fn()) {
  mockOpenmrsFetch.mockImplementation(async (url: string, init?: { method?: string }) => {
    if (init?.method === 'POST') {
      expect(url).toMatch(/\/ws\/rest\/v1\/actcore\/runchart$/);
      return { data: await snapshot() } as never;
    }
    expect(url).toMatch(/\/ws\/rest\/v1\/actcore\/runchart\/runs\?limit=30$/);
    return { data: runs } as never;
  });
}

const renderTile = () =>
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <RunChartSnapshotTile />
    </SWRConfig>,
  );
const nights = () => screen.getAllByTestId('run-chart-night');

describe('RunChartSnapshotTile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('says when the snapshot was last taken and for how many clinics', async () => {
    const last = run(0);
    backendAnswers({ running: false, runs: [last], lastTaken: last });

    renderTile();

    expect(
      await screen.findByText(`Last taken ${formatDatetime(new Date(last.finished))}, for 60 clinics`),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Take snapshot now' })).toBeEnabled();
  });

  it('says it has not been taken yet, and lists seven nights none of which ran', async () => {
    backendAnswers({ running: false, runs: [], lastTaken: null });

    renderTile();

    expect(await screen.findByText('Not taken yet')).toBeInTheDocument();
    expect(nights()).toHaveLength(7);
    expect(screen.getAllByText(/^Not run: nothing was recorded/)).toHaveLength(7);
  });

  it('lists the last seven nights with their rows, how long each took and whether it was taken', async () => {
    backendAnswers({ running: false, runs: [run(0), run(1, { rows: 62, durationMillis: 36000 })], lastTaken: run(0) });

    renderTile();

    const [today, yesterday] = await screen.findAllByTestId('run-chart-night').then((rows) => rows);
    expect(within(today).getByText('61')).toBeInTheDocument();
    expect(within(today).getByText('38 s')).toBeInTheDocument();
    expect(within(today).getByText('Taken')).toBeInTheDocument();
    expect(within(yesterday).getByText('62')).toBeInTheDocument();
    expect(within(yesterday).getByText('36 s')).toBeInTheDocument();
  });

  it('shows a failed night as failed, with its reason, and a night that never ran as not run', async () => {
    const failed = run(1, {
      status: 'failed',
      rows: 0,
      durationMillis: 2000,
      reason: 'APIException: No report has the uuid',
    });
    backendAnswers({ running: false, runs: [run(0), failed], lastTaken: run(0) });

    renderTile();

    const rows = await screen.findAllByTestId('run-chart-night');
    expect(within(rows[1]).getByText('Failed: the snapshot could not be taken')).toBeInTheDocument();
    expect(within(rows[1]).getByText('APIException: No report has the uuid')).toBeInTheDocument();
    expect(within(rows[1]).getByText('2 s')).toBeInTheDocument();
    expect(within(rows[2]).getByText(/^Not run: nothing was recorded/)).toBeInTheDocument();
  });

  it('marks a snapshot taken now, beside the nightly one it replaced', async () => {
    backendAnswers({ running: false, runs: [run(0, { source: 'manual' })], lastTaken: run(0, { source: 'manual' }) });

    renderTile();

    expect(within((await screen.findAllByTestId('run-chart-night'))[0]).getByText('Taken now')).toBeInTheDocument();
  });

  it('takes the snapshot, says how many rows it wrote, and reads the nights again', async () => {
    const user = userEvent.setup();
    const snapshot = vi.fn().mockResolvedValue({ snapshotTaken: true, rows: 61, clinics: 60 });
    backendAnswers({ running: false, runs: [], lastTaken: null }, snapshot);
    renderTile();

    await user.click(await screen.findByRole('button', { name: 'Take snapshot now' }));

    await waitFor(() => expect(showSnackbar).toHaveBeenCalled());
    expect(snapshot).toHaveBeenCalledTimes(1);
    expect(showSnackbar).toHaveBeenCalledWith({
      kind: 'success',
      title: "Today's run chart snapshot taken",
      subtitle: '61 rows (60 clinics and all clinics)',
    });
    const runsReads = mockOpenmrsFetch.mock.calls.filter(([url, init]) => !init && String(url).includes('/runs'));
    expect(runsReads.length).toBeGreaterThanOrEqual(2);
  });

  it('presses the same request again, as the server replaces the day', async () => {
    const user = userEvent.setup();
    const snapshot = vi.fn().mockResolvedValue({ snapshotTaken: true, rows: 61, clinics: 60 });
    backendAnswers({ running: false, runs: [], lastTaken: null }, snapshot);
    renderTile();

    await user.click(await screen.findByRole('button', { name: 'Take snapshot now' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Take snapshot now' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Take snapshot now' }));

    await waitFor(() => expect(snapshot).toHaveBeenCalledTimes(2));
  });

  it('says a snapshot is already running when the press did not run one', async () => {
    const user = userEvent.setup();
    backendAnswers(
      { running: false, runs: [], lastTaken: null },
      vi.fn().mockResolvedValue({ snapshotTaken: false, rows: null, clinics: null }),
    );
    renderTile();

    await user.click(await screen.findByRole('button', { name: 'Take snapshot now' }));

    await waitFor(() =>
      expect(showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'info', title: 'A snapshot is already running' }),
      ),
    );
  });

  it('says why a snapshot could not be taken, and shows the failed night it left', async () => {
    const user = userEvent.setup();
    backendAnswers(
      { running: false, runs: [], lastTaken: null },
      vi.fn().mockRejectedValue(new Error('The run chart snapshot failed')),
    );
    renderTile();

    await user.click(await screen.findByRole('button', { name: 'Take snapshot now' }));

    await waitFor(() =>
      expect(showSnackbar).toHaveBeenCalledWith({
        kind: 'error',
        title: 'Could not take the run chart snapshot',
        subtitle: 'The run chart snapshot failed',
      }),
    );
    const runsReads = mockOpenmrsFetch.mock.calls.filter(([url, init]) => !init && String(url).includes('/runs'));
    expect(runsReads.length).toBeGreaterThanOrEqual(2);
  });

  it('offers no snapshot while one is running, and reads the nights again every 5 seconds until it has finished', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      backendAnswers({ running: true, runs: [], lastTaken: null });

      renderTile();

      expect(await screen.findByText('A snapshot is already running')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Take snapshot now' })).toBeDisabled();
      const reads = () => mockOpenmrsFetch.mock.calls.length;
      const before = reads();
      await vi.advanceTimersByTimeAsync(5000);
      expect(reads()).toBeGreaterThan(before);
    } finally {
      vi.useRealTimers();
    }
  });

  it('says so when the nights cannot be read', async () => {
    mockOpenmrsFetch.mockRejectedValue(new Error('Server responded with 404'));

    renderTile();

    expect(await screen.findByText('Could not load the run chart snapshots')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Take snapshot now' })).not.toBeInTheDocument();
  });
});
