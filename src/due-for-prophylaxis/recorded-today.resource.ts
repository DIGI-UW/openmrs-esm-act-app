import { useMemo } from 'react';
import { type ReportRow } from '../reports/report-dataset.resource';
import { parseReportDate } from '../reports/report-date';

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * Whether the row's patient had a dose recorded today. ACT Core rewrites the patient's adherence row when a dose is
 * saved, so the report's last dose is current: its `recorded_today` says so on the server's clock, the clock its
 * statuses use; a report without that column is read by its `last_given` falling on today, here.
 */
export function recordedToday(row: ReportRow, today = new Date()) {
  if (row.recorded_today !== undefined && row.recorded_today !== null && row.recorded_today !== '') {
    return Number(row.recorded_today) === 1;
  }
  const lastGiven = parseReportDate(row.last_given);
  return lastGiven !== null && sameDay(lastGiven, today);
}

/** The patients among the rows recorded today, by uuid, read from the rows themselves: no request per patient. */
export function useRecordedToday(rows: Array<ReportRow>) {
  const recorded = useMemo(
    () => new Set(rows.filter((row) => recordedToday(row)).map((row) => String(row.patient_uuid))),
    [rows],
  );
  return { recorded };
}
