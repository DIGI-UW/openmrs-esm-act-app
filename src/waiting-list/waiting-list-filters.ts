import { type ReportRow } from '../reports/report-dataset.resource';
import { matchesColumns } from '../table-filters/distinct-values';
import { useUrlFilters } from '../table-filters/url-filters';

const keys = ['cardiac', 'primaryCare', 'type', 'procedure', 'urgency'] as const;

export type WaitingListFilters = Record<(typeof keys)[number], string>;

/** The report column each filter matches. */
export const filterColumns: Record<keyof WaitingListFilters, string> = {
  cardiac: 'cardiac_clinic',
  primaryCare: 'primary_care_clinic',
  type: 'procedure_type',
  procedure: 'procedure_name',
  urgency: 'urgency',
};

/** The waiting list's filters, kept in the page's URL so a view can be bookmarked. */
export function useWaitingListFilters() {
  return useUrlFilters(keys);
}

export function filterWaitingList(rows: Array<ReportRow>, filters: WaitingListFilters) {
  return rows.filter((row) => matchesColumns(row, filters, filterColumns));
}
