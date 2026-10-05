import useSWR from 'swr';
import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

export interface ReportColumn {
  name: string;
  label: string;
  datatype: string;
}

export type ReportRow = Record<string, unknown>;

interface EvaluatedReport {
  dataSets: Array<{ metadata: { columns: Array<ReportColumn> }; rows: Array<ReportRow> }>;
}

/** The ACT lists ACT Core serves, each behind its own privilege. */
export type ActList =
  | 'registry'
  | 'registryWaitingList'
  | 'careCascade'
  | 'worklists'
  | 'waitingList'
  | 'screenPositive';

async function evaluateList(list: ActList, params: Record<string, string>) {
  const { data } = await openmrsFetch<EvaluatedReport>(
    `${restBaseUrl}/actcore/list/${list}?${new URLSearchParams(params)}`,
  );
  return data.dataSets[0];
}

/**
 * Evaluates an ACT list's report and returns its first dataset, and `mutate` to evaluate it again.
 * A failure is not retried.
 * The server sends `columns` only with rows, so an empty dataset has none and a screen defines its own headers.
 */
export function useReportDataset(list: ActList | null, params: Record<string, string> = {}) {
  const { data, error, isLoading, mutate } = useSWR(
    list ? ['rhd-report-dataset', list, params] : null,
    () => evaluateList(list, params),
    { shouldRetryOnError: false },
  );

  return { columns: data?.metadata.columns ?? [], rows: data?.rows ?? [], isLoading, error, mutate };
}
