import { useMemo } from 'react';
import { useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { useSessionClinicRows } from '../registry/registry.resource';
import { useReportDataset } from '../reports/report-dataset.resource';
import { useRecordedToday } from './recorded-today.resource';

/** The Due for Prophylaxis report's rows of patients at the session's clinic. */
export function useDueRows() {
  const { dueForProphylaxis } = useConfig<Config>();
  const report = useReportDataset(dueForProphylaxis.report);
  // The report names each patient's primary care clinic, and no cardiac clinic.
  const scoped = useSessionClinicRows(report.rows, ['primary_care_clinic']);
  return { rows: scoped.rows, isLoading: report.isLoading || scoped.isLoading, error: report.error ?? scoped.error };
}

/**
 * The due list: its rows (useDueRows), who among them was recorded today, whether that is being checked again, and
 * how many are still waiting, left unknown until that lookup first answers or when it fails.
 */
export function useDueList() {
  const { rows, isLoading, error } = useDueRows();
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
