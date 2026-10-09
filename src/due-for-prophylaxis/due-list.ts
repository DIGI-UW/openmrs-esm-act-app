import { useMemo, useState } from 'react';
import { type TFunction } from 'i18next';
import { formatDate } from '@openmrs/esm-framework';
import { type ReportRow } from '../reports/report-dataset.resource';
import { parseReportDate } from '../reports/report-date';

export type DueFilter = 'bpg' | 'oral' | 'all';

export const isOral = (row: ReportRow) => row.prophylaxis_type === 'Oral';

/** The rows the BPG, Oral or All filter shows, and how many each would show. */
export function useDueFilter(rows: Array<ReportRow>) {
  const [filter, setFilter] = useState<DueFilter>('bpg');
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

/** How the patient takes prophylaxis: "BPG · every 28 days", or the oral regimen's name. */
export function prescription(t: TFunction, row: ReportRow) {
  if (!isOral(row)) {
    return t('bpgEveryDays', 'BPG · every {{days}} days', { days: row.injection_interval_days });
  }
  return row.regimen ? String(row.regimen) : t('oral', 'Oral');
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

export function statusLabel(t: TFunction, row: ReportRow, recordedToday: boolean) {
  if (recordedToday) {
    return t('recordedToday', 'Recorded today');
  }
  if (row.status === 'due_soon') {
    return t('dueIn48Hours', 'Due in 48 h');
  }
  return row.status === 'due_today' ? t('dueToday', 'Due today') : t('overdue', 'Overdue');
}
