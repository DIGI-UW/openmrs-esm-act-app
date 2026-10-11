import { useMemo } from 'react';
import { useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { useReportDataset } from '../reports/report-dataset.resource';
import { useRecordedToday } from './recorded-today.resource';

/**
 * The due list: the report's rows, who among all of them was recorded today, whether that is being checked again, and
 * how many are still waiting, left unknown until that lookup first answers or when it fails.
 */
export function useDueList() {
  const { dueForProphylaxis } = useConfig<Config>();
  const { rows, isLoading, error } = useReportDataset(dueForProphylaxis.report);
  const patientUuids = useMemo(() => rows.map((row) => String(row.patient_uuid)), [rows]);
  const {
    recorded,
    isLoading: recordedLoading,
    isValidating: checking,
    error: recordedError,
  } = useRecordedToday(patientUuids);
  // Waiting means due now: a dose due in the next two days is listed, but nobody is waiting for it yet.
  const waiting =
    recordedError || recordedLoading
      ? undefined
      : rows.filter((row) => row.status !== 'due_soon' && !recorded.has(String(row.patient_uuid))).length;
  return { rows, recorded, recordedError, checking, waiting, isLoading: isLoading || recordedLoading, error };
}
