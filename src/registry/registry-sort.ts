import { type ReportRow } from '../reports/report-dataset.resource';

export interface RegistrySort {
  key: 'name' | 'age' | 'bpg' | 'adherence';
  direction: 'ASC' | 'DESC';
}

const number = (value: unknown) => (value == null || value === '' ? null : Number(value));

/** BPG status sorts by days until the next dose; a patient with no next dose has none. */
const sortValue: Record<RegistrySort['key'], (row: ReportRow) => string | number | null> = {
  name: (row) => (row.full_name == null ? null : String(row.full_name)),
  age: (row) => number(row.age_years),
  bpg: (row) => number(row.days_until_due),
  adherence: (row) => number(row.adherence),
};

/** The rows in the chosen order, patients without a value last either way; no sort keeps the report's order. */
export function sortRegistry(rows: Array<ReportRow>, sort: RegistrySort | null) {
  if (!sort) {
    return rows;
  }
  const value = sortValue[sort.key];
  const sign = sort.direction === 'ASC' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const [x, y] = [value(a), value(b)];
    if (x == null || y == null) {
      return Number(x == null) - Number(y == null);
    }
    return sign * (typeof x === 'string' ? x.localeCompare(String(y)) : x - Number(y));
  });
}

/** Carbon's header cycle: ascending, then descending, then the report's order. */
export function nextSort(current: RegistrySort | null, key: RegistrySort['key']): RegistrySort | null {
  if (current?.key !== key) {
    return { key, direction: 'ASC' };
  }
  return current.direction === 'ASC' ? { key, direction: 'DESC' } : null;
}
