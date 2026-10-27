import useSWR from 'swr';
import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

/** One run of ACT Core's run chart snapshot, the nightly one or one taken now. */
export interface RunChartRun {
  /** The day snapshotted, YYYY-MM-DD. */
  runDate: string;
  /** An ISO-8601 instant. */
  finished: string;
  durationMillis: number;
  source: 'scheduled' | 'manual';
  status: 'taken' | 'failed';
  /** Rows written, with the row of every clinic among them; 0 for a failed run. */
  rows: number;
  clinics: number;
  /** Why a failed run failed. */
  reason: string | null;
}

export interface RunChartRuns {
  running: boolean;
  /** Newest first. */
  runs: Array<RunChartRun>;
  lastTaken: RunChartRun | null;
}

export interface SnapshotAnswer {
  /** False when another run was in progress, so this one did not run. */
  snapshotTaken: boolean;
  rows: number | null;
  clinics: number | null;
}

const runsUrl = `${restBaseUrl}/actcore/runchart/runs?limit=100`;
const snapshotUrl = `${restBaseUrl}/actcore/runchart`;

/** The latest runs, read again every 5 seconds while one is in progress. */
export function useRunChartRuns() {
  const { data, error, isLoading, mutate } = useSWR<RunChartRuns, Error>(
    runsUrl,
    async () => (await openmrsFetch<RunChartRuns>(runsUrl)).data,
    { refreshInterval: (runs) => (runs?.running ? 5000 : 0), shouldRetryOnError: false },
  );
  return { runs: data, error, isLoading, mutate };
}

/** Takes today's snapshot now, replacing today's rows, and answers once it has finished. */
export async function takeRunChartSnapshot() {
  const { data } = await openmrsFetch<SnapshotAnswer>(snapshotUrl, { method: 'POST' });
  return data;
}
