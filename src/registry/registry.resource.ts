import { useMemo } from 'react';
import dayjs from 'dayjs';
import { useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { type ReportRow, useReportDataset } from '../reports/report-dataset.resource';
import { useSessionClinicScope } from '../session-clinic';

/** The registry report's rows: every patient on the registry, as the Registry and the worklists show them. */
export function useRegistryReport(enabled = true) {
  const { registry } = useConfig<Config>();
  const params = useMemo(() => ({ startDate: '1900-01-01', endDate: dayjs().format('YYYY-MM-DD') }), []);
  return useReportDataset(enabled ? registry.report : null, params);
}

/** Whether a registry row's patient is enrolled now and alive, so on lists of patients to act on. */
export const onRegistryNow = (row: ReportRow) =>
  row.enrollment_status === 'Active' && !(row.deceased === true || Number(row.deceased) === 1);

/** The clinic columns the reports with both name for each patient. */
export const bothClinics = ['cardiac_clinic', 'primary_care_clinic'] as const;

/**
 * A report's rows of patients at the session's clinic (useSessionClinicScope), by the row's own clinic column where
 * the report has it, else by the patient's registry row. No one while the session location is looked up, and an error
 * when its kind cannot be read, rather than every clinic's patients.
 */
export function useSessionClinicReport(
  report: { rows: Array<ReportRow>; isLoading: boolean; error?: Error },
  columnsOfRows: ReadonlyArray<string>,
) {
  const scope = useSessionClinicScope();
  const { status } = scope;
  const column = status === 'ready' ? scope.column : null;
  const clinicName = status === 'ready' ? scope.clinic?.name : null;
  const viaRegistry = Boolean(column) && !columnsOfRows.includes(column);
  const registry = useRegistryReport(viaRegistry);
  const rows = useMemo(() => {
    if (status !== 'ready') {
      return [];
    }
    if (!column) {
      return report.rows;
    }
    const byPatient = new Map(registry.rows.map((row) => [String(row.patient_uuid), row]));
    return report.rows.filter((row) => {
      const source = viaRegistry ? byPatient.get(String(row.patient_uuid)) : row;
      return String(source?.[column] ?? '') === clinicName;
    });
  }, [status, column, clinicName, viaRegistry, report.rows, registry.rows]);
  return {
    rows,
    isLoading: report.isLoading || status === 'pending' || (viaRegistry && registry.isLoading),
    error:
      report.error ??
      (status === 'error' ? new Error('The session location could not be read') : undefined) ??
      (viaRegistry ? registry.error : undefined),
  };
}
