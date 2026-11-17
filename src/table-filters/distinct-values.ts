import { type ReportRow } from '../reports/report-dataset.resource';

/** The distinct values a column takes, sorted, for a filter's options. */
export function distinctValues(rows: Array<ReportRow>, column: string) {
  return [
    ...new Set(
      rows
        .map((row) => row[column])
        .filter(Boolean)
        .map(String),
    ),
  ].sort();
}

/** Whether a row has each chosen filter's value in that filter's report column; an empty filter matches every row. */
export function matchesColumns<K extends string>(
  row: ReportRow,
  filters: Partial<Record<NoInfer<K>, string>>,
  columns: Record<K, string>,
) {
  return (Object.keys(columns) as Array<K>).every(
    (key) => !filters[key] || String(row[columns[key]] ?? '') === filters[key],
  );
}
