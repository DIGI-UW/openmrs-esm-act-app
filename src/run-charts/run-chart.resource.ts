import useSWR from 'swr';
import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { type RunChartPeriod } from './run-chart-metrics';
import { type RunChartPoint } from './run-chart-stats';

export interface RunChartParams {
  metric: string;
  /** A clinic's location uuid, or null for every clinic. */
  clinic: string | null;
  /** YYYY-MM-DD. */
  startDate: string;
  endDate: string;
  points: RunChartPeriod;
}

export interface RunChart {
  metric: string;
  points: Array<RunChartPoint>;
  /** Of the points' values, none counted for a point with no value; null with no value at all. */
  median: number | null;
  /** The latest day any clinic was snapshotted, or null before the first. */
  lastSnapshot: string | null;
}

/** A metric over a range in points, from ACT Core's nightly snapshot; null params ask for nothing. */
export function useRunChart(params: RunChartParams | null) {
  const { data, error, isLoading, mutate } = useSWR(
    params ? ['act-run-chart', params.metric, params.clinic, params.startDate, params.endDate, params.points] : null,
    async () => {
      const query = new URLSearchParams({
        metric: params.metric,
        startDate: params.startDate,
        endDate: params.endDate,
        points: params.points,
      });
      if (params.clinic) {
        query.set('clinic', params.clinic);
      }
      const { data } = await openmrsFetch<RunChart>(`${restBaseUrl}/actcore/runchart?${query}`);
      return data;
    },
    { shouldRetryOnError: false },
  );
  return {
    points: data?.points ?? [],
    median: data?.median ?? null,
    lastSnapshot: data?.lastSnapshot ?? null,
    isLoading: Boolean(params) && isLoading,
    error: error as Error | undefined,
    mutate,
  };
}
