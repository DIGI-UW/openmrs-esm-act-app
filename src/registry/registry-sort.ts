import { type ReportRow } from '../reports/report-dataset.resource';
import { type ColumnSort, sortItems } from '../table-filters/column-sort';

export type RegistrySort = ColumnSort<
  'name' | 'age' | 'bpg' | 'adherence' | 'prophylaxis' | 'lastUpdated' | 'procedureDue'
>;

const number = (value: unknown) => (value == null || value === '' ? null : Number(value));
const date = (value: unknown) => (typeof value === 'string' && value ? value.slice(0, 10) : null);
const text = (value: unknown) => (value == null || value === '' ? null : String(value));

// The least covered first, as the status tag's colours read, and the patients with no BPG status last.
const bpgRanks = ['Not covered', 'Deadline approaching', 'Covered', 'Oral', 'No prescription'];
// Days until the next dose are a day count of a year or two at most, so a rank outweighs them.
const bpgRankWeight = 100000;

/** A BPG status sorts by its rank, then by days until the next dose; a patient with no status has none. */
function bpgValue(row: ReportRow) {
  const rank = bpgRanks.indexOf(String(row.bpg_status));
  return rank < 0 ? null : rank * bpgRankWeight + (number(row.days_until_due) ?? 0);
}

const sortValue: Record<RegistrySort['key'], (row: ReportRow) => string | number | null> = {
  name: (row) => (row.full_name == null ? null : String(row.full_name)),
  age: (row) => number(row.age_years),
  bpg: bpgValue,
  adherence: (row) => number(row.adherence),
  prophylaxis: (row) => text(row.prophylaxis_regimen),
  lastUpdated: (row) => date(row.last_updated),
  procedureDue: (row) => date(row.earliest_procedure_due),
};

/** The rows in the chosen order, patients without a value last either way; no sort keeps the report's order. */
export const sortRegistry = (rows: Array<ReportRow>, sort: RegistrySort | null) =>
  sortItems(rows, sort, (row, key) => sortValue[key](row));
