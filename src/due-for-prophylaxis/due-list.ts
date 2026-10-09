import { useMemo, useState } from 'react';
import { type TFunction } from 'i18next';
import { formatDate } from '@openmrs/esm-framework';
import { type ReportRow } from '../reports/report-dataset.resource';
import { parseReportDate } from '../reports/report-date';

export type DueFilter = 'bpg' | 'oral' | 'all';

export const isOral = (row: ReportRow) => row.prophylaxis_type === 'Oral';

/** The rows the BPG, Oral or All filter shows, and how many each would show. */
export function useDueFilter(rows: Array<ReportRow>, initial: DueFilter = 'bpg') {
  const [filter, setFilter] = useState<DueFilter>(initial);
  const counts = useMemo(
    () => ({ bpg: rows.filter((row) => !isOral(row)).length, oral: rows.filter(isOral).length, all: rows.length }),
    [rows],
  );
  const filtered = useMemo(
    () => (filter === 'all' ? rows : rows.filter((row) => isOral(row) === (filter === 'oral'))),
    [rows, filter],
  );
  return { filter, setFilter, counts, filtered };
}

/** How the patient takes prophylaxis: "BPG · every 28 days", else the regimen's name, or None without a prescription. */
export function prescription(t: TFunction, row: ReportRow) {
  if (row.status === 'no_prescription') {
    return t('none', 'None');
  }
  if (!isOral(row) && row.injection_interval_days) {
    return t('bpgEveryDays', 'BPG · every {{days}} days', { days: row.injection_interval_days });
  }
  return row.regimen ? String(row.regimen) : isOral(row) ? t('oral', 'Oral') : '';
}

export function lastDose(row: ReportRow) {
  const date = parseReportDate(row.last_given);
  return date ? formatDate(date, { time: false, noToday: true }) : '';
}

/** Adherence as a percentage, or nothing when ACT Core has not computed it. */
export function adherence(row: ReportRow) {
  return row.adherence === null || row.adherence === undefined || row.adherence === '' ? null : Number(row.adherence);
}

/** Below the care cascade's Adherent (80%+) threshold. */
export const lowAdherence = (percent: number) => percent < 80;

export interface DueColumn {
  key: 'patient' | 'actId' | 'prescription' | 'lastDose' | 'status' | 'adherence';
  header: string;
  text: (row: ReportRow) => string;
}

/** The due list's columns, as the table heads them and the CSV holds them. */
export function dueColumns(t: TFunction, recorded: Set<string>): Array<DueColumn> {
  return [
    { key: 'patient', header: t('patient', 'Patient'), text: (row) => String(row.full_name ?? '') },
    { key: 'actId', header: t('actId', 'ACT ID'), text: (row) => String(row.rhd_id ?? '') },
    { key: 'prescription', header: t('prescription', 'Prescription'), text: (row) => prescription(t, row) },
    { key: 'lastDose', header: t('lastDose', 'Last dose'), text: lastDose },
    {
      key: 'status',
      header: t('status', 'Status'),
      text: (row) => statusLabel(t, row, recorded.has(String(row.patient_uuid))),
    },
    {
      key: 'adherence',
      header: t('adherence', 'Adherence'),
      text: (row) => (adherence(row) === null ? '' : `${adherence(row)}%`),
    },
  ];
}

export function statusLabel(t: TFunction, row: ReportRow, recordedToday: boolean) {
  if (recordedToday) {
    return t('recordedToday', 'Recorded today');
  }
  if (row.status === 'up_to_date') {
    return t('upToDate', 'Up to date');
  }
  if (row.status === 'no_prescription') {
    return t('noPrescription', 'No prescription');
  }
  if (!row.status) {
    return '';
  }
  if (row.status === 'due_soon') {
    return t('dueIn48Hours', 'Due in 48 h');
  }
  return row.status === 'due_today' ? t('dueToday', 'Due today') : t('overdue', 'Overdue');
}

/** Why the patient is on the due worklist: its status, with the date the dose was or is due when not today. */
export function dueReason(t: TFunction, row: ReportRow, recordedToday: boolean) {
  const label = statusLabel(t, row, recordedToday);
  const due = parseReportDate(row.next_due);
  if (recordedToday || row.status === 'due_today' || !due) {
    return label;
  }
  const date = formatDate(due, { time: false, noToday: true });
  return row.status === 'overdue' ? t('overdueWasDue', 'Overdue · was due {{date}}', { date }) : `${label} · ${date}`;
}
