import useSWR from 'swr';
import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

export interface RunChart {
  metric: string;
  startDate: string;
  endDate: string;
  /** One per day with a snapshot: the metric's total, or its percent, null for a percent of none. */
  points: Array<{ date: string; value: number | null }>;
  /** The latest day with a snapshot, as YYYY-MM-DD, or null before the first. */
  lastSnapshot: string | null;
}

const runChartUrl = `${restBaseUrl}/actcore/runchart`;

/** ACT 2.0's run chart metrics, as ACT Core names them, and whether each is a percent. */
export const runChartMetrics = [
  { metric: 'total_registrants', percent: false },
  { metric: 'active_registrants', percent: false },
  { metric: 'active_registrants_seen_last_7_months', percent: true },
  { metric: 'active_registrants_prescribed_prophylaxis', percent: true },
  { metric: 'active_registrants_adherent', percent: true },
  { metric: 'consultation_visits_with_echocardiogram_resulted', percent: true },
  { metric: 'consultation_visits_with_intervention', percent: true },
  { metric: 'interventions_completed', percent: false },
] as const;

/** A metric's daily values over the range, of the clinic or, with none, of every clinic. */
export function useRunChart(metric: string, clinic: string | undefined, startDate: string, endDate: string) {
  const params = new URLSearchParams({ metric, startDate, endDate, ...(clinic && { clinic }) });
  const url = `${runChartUrl}?${params}`;
  const { data, error, isLoading, mutate } = useSWR<RunChart, Error>(
    url,
    async () => (await openmrsFetch<RunChart>(url)).data,
    { shouldRetryOnError: false },
  );
  return { runChart: data, error, isLoading, mutate };
}

/** Takes today's snapshot now; snapshotTaken is false when one was already being taken. */
export async function takeSnapshot() {
  const { data } = await openmrsFetch<{ snapshotTaken: boolean; rows: number | null; lastSnapshot: string | null }>(
    runChartUrl,
    { method: 'POST' },
  );
  return data;
}
