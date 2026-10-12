import { useCallback, useMemo } from 'react';
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

/**
 * Which of a list's rows are patients at the session's clinic (useSessionClinicScope): by the row's own clinic column
 * where the list's report has it, else by the patient's registry row. Every row while the session location is not a
 * clinic, or its kind cannot be read, as the registry then opens on every clinic; none while that kind is looked up.
 */
function useInSessionClinic(columnsOfRows: ReadonlyArray<string>) {
  const scope = useSessionClinicScope();
  const column = scope.status === 'ready' ? scope.column : null;
  const clinicName = scope.status === 'ready' ? scope.clinic?.name : null;
  const pending = scope.status === 'pending';
  const viaRegistry = Boolean(column) && !columnsOfRows.includes(column);
  const registry = useRegistryReport(viaRegistry);
  const byPatient = useMemo(
    () => new Map(registry.rows.map((row) => [String(row.patient_uuid), row])),
    [registry.rows],
  );
  const inClinic = useCallback(
    (row: ReportRow) => {
      if (pending) {
        return false;
      }
      if (!column) {
        return true;
      }
      const source = viaRegistry ? byPatient.get(String(row.patient_uuid)) : row;
      return String(source?.[column] ?? '') === clinicName;
    },
    [pending, column, clinicName, viaRegistry, byPatient],
  );
  return {
    inClinic,
    isLoading: pending || (viaRegistry && registry.isLoading),
    error: viaRegistry ? registry.error : undefined,
  };
}

/** The rows of patients at the session's clinic, by useInSessionClinic. */
function useSessionClinicRows(rows: Array<ReportRow>, columnsOfRows: ReadonlyArray<string>) {
  const { inClinic, isLoading, error } = useInSessionClinic(columnsOfRows);
  const scoped = useMemo(() => rows.filter(inClinic), [rows, inClinic]);
  return { rows: scoped, isLoading, error };
}

/** The clinic columns the reports with both name for each patient. */
export const bothClinics = ['cardiac_clinic', 'primary_care_clinic'] as const;

/** A report's rows of patients at the session's clinic (useInSessionClinic), loading or failing with the report. */
export function useSessionClinicReport(
  report: { rows: Array<ReportRow>; isLoading: boolean; error?: Error },
  columnsOfRows: ReadonlyArray<string>,
) {
  const scoped = useSessionClinicRows(report.rows, columnsOfRows);
  return { rows: scoped.rows, isLoading: report.isLoading || scoped.isLoading, error: report.error ?? scoped.error };
}
