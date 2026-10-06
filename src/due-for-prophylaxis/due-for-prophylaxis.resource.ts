import { useMemo } from 'react';
import { useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { useReportDataset } from '../reports/report-dataset.resource';
import { useRecordedToday } from './recorded-today.resource';

/** The due list: the report's rows, who among all of them was recorded today, and how many are still waiting. */
export function useDueList() {
  const { dueForProphylaxis } = useConfig<Config>();
  const { rows, isLoading, error } = useReportDataset(dueForProphylaxis.report);
  const patientUuids = useMemo(() => rows.map((row) => String(row.patient_uuid)), [rows]);
  const { recorded } = useRecordedToday(patientUuids);
  const waiting = patientUuids.filter((uuid) => !recorded.has(uuid)).length;
  return { rows, recorded, waiting, isLoading, error };
}
