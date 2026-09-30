import { type ReportRow } from '../reports/report-dataset.resource';
import { matchesColumns } from '../table-filters/distinct-values';
import { useUrlFilters } from '../table-filters/url-filters';

const keys = ['status', 'cardiac', 'primaryCare', 'category', 'bpg', 'flag', 'q'] as const;

export type RegistryFilters = Record<(typeof keys)[number], string>;

/** The report column each dropdown filter offers the values of. */
export const registryFilterColumns = {
  status: 'enrollment_status',
  cardiac: 'cardiac_clinic',
  primaryCare: 'primary_care_clinic',
  category: 'diagnosis_category',
  bpg: 'bpg_status',
} as const;

/** The registry's filters, kept in the page's URL so a view can be bookmarked. */
export function useRegistryFilters() {
  return useUrlFilters(keys);
}

/** The RHD flags whose patient lists a patient is on, which the report separates by |. */
export function rowFlags(row: ReportRow) {
  return String(row.rhd_flags ?? '')
    .split('|')
    .filter(Boolean);
}

export function filterRegistry(rows: Array<ReportRow>, filters: RegistryFilters) {
  const q = filters.q.trim().toLowerCase();
  return rows.filter(
    (row) =>
      matchesColumns(row, filters, registryFilterColumns) &&
      (!filters.flag || rowFlags(row).includes(filters.flag)) &&
      (!q ||
        [row.full_name, row.rhd_id].some((value) =>
          String(value ?? '')
            .toLowerCase()
            .includes(q),
        )),
  );
}
