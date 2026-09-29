import useSWR from 'swr';
import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { fetchAll } from '../fetch-all';

export interface ReportColumn {
  name: string;
  label: string;
  datatype: string;
}

export type ReportRow = Record<string, unknown>;

interface EvaluatedReport {
  dataSets: Array<{ metadata: { columns: Array<ReportColumn> }; rows: Array<ReportRow> }>;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** reportDefinition?q matches names containing the text, so the exact name is picked from its hits. */
async function findReportUuid(name: string) {
  const definitions = await fetchAll<{ uuid: string; name: string }>(
    `${restBaseUrl}/reportingrest/reportDefinition?q=${encodeURIComponent(name)}&v=custom:(uuid,name)`,
  );
  const report = definitions.find((definition) => definition.name === name);
  if (!report) {
    throw new Error(`No report is named "${name}"`);
  }
  return report.uuid;
}

async function evaluateReport(reportUuidOrName: string, params: Record<string, string>) {
  const uuid = uuidPattern.test(reportUuidOrName) ? reportUuidOrName : await findReportUuid(reportUuidOrName);
  const { data } = await openmrsFetch<EvaluatedReport>(
    `${restBaseUrl}/reportingrest/reportdata/${uuid}?${new URLSearchParams(params)}`,
  );
  return data.dataSets[0];
}

/**
 * Evaluates a report, given by uuid or by name, and returns its first dataset, and `mutate` to evaluate it again.
 * A failure is not retried.
 * The server sends `columns` only with rows, so an empty dataset has none and a screen defines its own headers.
 */
export function useReportDataset(reportUuidOrName: string | null, params: Record<string, string> = {}) {
  const { data, error, isLoading, mutate } = useSWR(
    reportUuidOrName ? ['rhd-report-dataset', reportUuidOrName, params] : null,
    () => evaluateReport(reportUuidOrName, params),
    { shouldRetryOnError: false },
  );

  return { columns: data?.metadata.columns ?? [], rows: data?.rows ?? [], isLoading, error, mutate };
}
