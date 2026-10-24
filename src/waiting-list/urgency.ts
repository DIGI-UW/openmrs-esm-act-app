import { type Config } from '../config-schema';
import { type ReportRow } from '../reports/report-dataset.resource';
import { parseReportDate } from '../reports/report-date';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface WaitingRow {
  row: ReportRow;
  daysPending: number | null;
  /** The row's band's position in the configured bands; bands earlier in the list are more urgent. */
  band: number;
  overdue: boolean;
}

/** Days from the date a recommendation was added to today, counted in whole calendar days. */
function daysSince(value: unknown, today: Date) {
  const added = parseReportDate(value);
  if (!added) {
    return null;
  }
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((start.getTime() - added.getTime()) / DAY_MS);
}

/** The rows with each urgency named by its band's `name`, else its `label`, else the report's name. */
export function labelUrgencies(rows: Array<ReportRow>, bands: Config['urgencyBands'], name: 'label' | 'shortLabel') {
  return rows.map((row) => {
    const band = bands.find((b) => b.concept === row.urgency_concept);
    const urgency = band?.[name] ?? band?.label;
    return urgency ? { ...row, urgency } : row;
  });
}

/** Each row with its days pending and whether it is past its urgency band's deadline, overdue first, then by band. */
export function rankWaitingRows(rows: Array<ReportRow>, bands: Config['urgencyBands'], today = new Date()) {
  return rows
    .map((row): WaitingRow => {
      const daysPending = daysSince(row.date_added, today);
      const band = bands.findIndex((b) => b.concept === row.urgency_concept);
      const overdue = band >= 0 && daysPending !== null && daysPending > bands[band].deadlineDays;
      return { row, daysPending, band: band >= 0 ? band : bands.length, overdue };
    })
    .sort(
      (a, b) =>
        Number(b.overdue) - Number(a.overdue) || a.band - b.band || (b.daysPending ?? -1) - (a.daysPending ?? -1),
    );
}
