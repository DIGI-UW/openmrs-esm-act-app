import { useMemo } from 'react';
import { useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { useReportDataset } from '../reports/report-dataset.resource';
import { useRecordedToday } from './recorded-today.resource';

/**
 * The due list: the report's rows, who among all of them was recorded today, and how many are still waiting, left
 * unknown when that lookup fails.
 */
export function useDueList() {
  const { dueForProphylaxis } = useConfig<Config>();
  const { rows, isLoading, error } = useReportDataset(dueForProphylaxis.report);
  const patientUuids = useMemo(() => rows.map((row) => String(row.patient_uuid)), [rows]);
  const { recorded, isLoading: recordedLoading, error: recordedError } = useRecordedToday(patientUuids);
  const waiting = recordedError ? undefined : patientUuids.filter((uuid) => !recorded.has(uuid)).length;
  return { rows, recorded, recordedError, waiting, isLoading: isLoading || recordedLoading, error };
}
