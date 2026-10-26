import { formatDate } from '@openmrs/esm-framework';
import { type ClinicLimit } from '../clinic-limit';
import { type Config } from '../config-schema';
import { parseReportDate } from '../reports/report-date';
import { type ReportColumn, type ReportRow } from '../reports/report-dataset.resource';

export type CatalogueEntry = Config['reportCatalogue'][number];

/** The reports a user may open: one held to clinics gets only those it can hold to them, the rest being unseen. */
export function reportsFor(catalogue: Array<CatalogueEntry>, limit: ClinicLimit) {
  if (limit.status === 'pending') {
    return [];
  }
  return limit.status === 'none' ? catalogue : catalogue.filter((entry) => entry.clinicColumn);
}

/** The rows of a report the user is held to clinics for: those whose clinic column is one of their clinics. */
export function limitToClinics(rows: Array<ReportRow>, entry: CatalogueEntry, limit: ClinicLimit) {
  if (limit.status === 'none') {
    return rows;
  }
  if (limit.status === 'pending' || !entry.clinicColumn) {
    return [];
  }
  return rows.filter((row) => limit.names.includes(String(row[entry.clinicColumn] ?? '')));
}

/** A column's heading: its label, or the words of its name when the report gave it no label of its own. */
export function columnHeader({ name, label }: ReportColumn) {
  if (label && label !== name) {
    return label;
  }
  const words = name.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const midnight = /^\d{4}-\d{2}-\d{2}T00:00:00(\.0+)?(Z|[+-]\d{2}:?\d{2})?$/;

/** A date column: typed so, or, as the reports send every column typed Object, a value that is a day at midnight. */
const isDate = (value: unknown, datatype: string) =>
  datatype.includes('Date') || (typeof value === 'string' && midnight.test(value));

/** A cell as the table shows it and the CSV holds it. */
export function cellText(value: unknown, datatype: string): string {
  if (value == null) {
    return '';
  }
  if (isDate(value, datatype)) {
    const date = parseReportDate(value);
    if (date) {
      return formatDate(date, { time: false, noToday: true });
    }
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/** What a column sorts by: a date by its day, a number as a number, anything else by its text. */
export function sortValue(value: unknown, datatype: string): string | number | null {
  if (value == null) {
    return null;
  }
  if (isDate(value, datatype)) {
    return parseReportDate(value)?.getTime() ?? null;
  }
  return typeof value === 'number' ? value : cellText(value, datatype);
}

/** Whether any column's text holds the search, whatever its case; a blank search matches every row. */
export function matchesSearch(row: ReportRow, columns: Array<ReportColumn>, search: string) {
  const query = search.trim().toLowerCase();
  return !query || columns.some((column) => cellText(row[column.name], column.datatype).toLowerCase().includes(query));
}
