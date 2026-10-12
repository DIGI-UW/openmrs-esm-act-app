import { useClinicFilterDefaults } from '../session-clinic';
import { type ReportRow } from '../reports/report-dataset.resource';
import { matchesColumns } from '../table-filters/distinct-values';
import { type FilterDefaults, useUrlFilters } from '../table-filters/url-filters';

const keys = ['status', 'cardiac', 'primaryCare', 'category', 'prophylaxis', 'bpg', 'flag', 'q'] as const;

export type RegistryFilters = Record<(typeof keys)[number], string>;

/** The report column each dropdown filter matches. */
export const registryFilterColumns = {
  status: 'enrollment_status',
  cardiac: 'cardiac_clinic',
  primaryCare: 'primary_care_clinic',
  category: 'diagnosis_category',
  prophylaxis: 'prophylaxis_regimen',
  bpg: 'bpg_status',
} as const;

/** Active patients at the session's clinic, cardiac or primary care, as the report names its clinics. */
function useRegistryDefaults(): FilterDefaults<(typeof keys)[number]> {
  const clinic = useClinicFilterDefaults();
  return clinic === 'pending' ? 'pending' : { status: 'Active', ...clinic };
}

/** The registry's filters, kept in the page's URL so a view can be bookmarked. */
export function useRegistryFilters() {
  return useUrlFilters(keys, useRegistryDefaults());
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
        [row.full_name, row.rhd_id, row.external_id].some((value) =>
          String(value ?? '')
            .toLowerCase()
            .includes(q),
        )),
  );
}
