import { useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { useReportDataset } from '../reports/report-dataset.resource';
import { useRecordedToday } from './recorded-today.resource';

/**
 * The due list: the report's rows, who among all of them was recorded today, and how many are still waiting.
 */
export function useDueList() {
  const { dueForProphylaxis } = useConfig<Config>();
  const { rows, isLoading, error } = useReportDataset(dueForProphylaxis.report);
  const { recorded } = useRecordedToday(rows);
  // Waiting means due now: a dose due in the next two days is listed, but nobody is waiting for it yet.
  const waiting = rows.filter((row) => row.status !== 'due_soon' && !recorded.has(String(row.patient_uuid))).length;
  return { rows, recorded, waiting, isLoading, error };
}
