import { useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { useSessionClinicReport } from '../registry/registry.resource';
import { useReportDataset } from '../reports/report-dataset.resource';
import { useRecordedToday } from './recorded-today.resource';

/** The Due for Prophylaxis report's rows of patients at the session's clinic. */
export function useDueRows() {
  const { dueForProphylaxis } = useConfig<Config>();
  // The report names each patient's primary care clinic, and no cardiac clinic.
  return useSessionClinicReport(useReportDataset(dueForProphylaxis.report), ['primary_care_clinic']);
}

/**
 * The due list: its rows (useDueRows), who among all of them was recorded today, and how many are still waiting.
 */
export function useDueList() {
  const { rows, isLoading, error } = useDueRows();
  const { recorded } = useRecordedToday(rows);
  // Waiting means due now: a dose due in the next two days is listed, but nobody is waiting for it yet.
  const waiting = rows.filter((row) => row.status !== 'due_soon' && !recorded.has(String(row.patient_uuid))).length;
  return { rows, recorded, waiting, isLoading, error };
}
