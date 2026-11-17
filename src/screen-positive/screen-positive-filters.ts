import { type ReportRow } from '../reports/report-dataset.resource';
import { matchesColumns } from '../table-filters/distinct-values';
import { useClinicFilterDefaults } from '../session-clinic';
import { useUrlFilters } from '../table-filters/url-filters';

const keys = ['cardiac', 'primaryCare', 'sex'] as const;

export type ScreenPositiveFilters = Record<(typeof keys)[number], string>;

/** The report column each filter matches. */
export const filterColumns: Record<keyof ScreenPositiveFilters, string> = {
  cardiac: 'cardiac_clinic',
  primaryCare: 'primary_care_clinic',
  sex: 'sex',
};

/** The list's filters, opening on the session's clinic, kept in the page's URL so a view can be bookmarked. */
export function useScreenPositiveFilters() {
  return useUrlFilters<(typeof keys)[number]>(keys, useClinicFilterDefaults());
}

export function filterScreenPositive(rows: Array<ReportRow>, filters: ScreenPositiveFilters) {
  return rows.filter((row) => matchesColumns(row, filters, filterColumns));
}
