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
  const waiting =
    recordedError || recordedLoading ? undefined : patientUuids.filter((uuid) => !recorded.has(uuid)).length;
  return { rows, recorded, recordedError, checking, waiting, isLoading: isLoading || recordedLoading, error };
}
