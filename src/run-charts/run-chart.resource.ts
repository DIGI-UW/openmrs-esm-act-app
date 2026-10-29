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

export interface RunChartSeries {
  points: Array<RunChartPoint>;
  /** Of the points' values, none counted for a point with no value; null with no value at all. */
  median: number | null;
}

/** ACT Core's answer: every metric's points over the range, calculated when asked. */
export interface RunChart {
  startDate: string;
  endDate: string;
  period: RunChartPeriod;
  metrics: Record<string, RunChartSeries>;
}

/** The request for a range: the metric is left out, as ACT Core answers every metric at once. */
function urlOf(params: RunChartParams) {
  const query = new URLSearchParams({ startDate: params.startDate, endDate: params.endDate, points: params.points });
  if (params.clinic) {
    query.set('clinic', params.clinic);
  }
  return `${restBaseUrl}/actcore/runchart?${query}`;
}

/**
 * A metric over a range in points of the period, for the clinic; null params ask for nothing. ACT Core calculates every
 * metric in one pass, so one request serves every metric asked for over the same range, and the metric is read from it.
 */
export function useRunChart(params: RunChartParams | null) {
  const { data, error, isLoading, mutate } = useSWR(
    params ? urlOf(params) : null,
    async (url: string) => {
      const { data } = await openmrsFetch<RunChart>(url);
      return data;
    },
    { shouldRetryOnError: false },
  );
  const series = params ? data?.metrics?.[params.metric] : undefined;
  return {
    points: series?.points ?? [],
    median: series?.median ?? null,
    isLoading: Boolean(params) && isLoading,
    error: error as Error | undefined,
    mutate,
  };
}
