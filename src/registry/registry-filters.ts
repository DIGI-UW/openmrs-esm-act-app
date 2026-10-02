import useSWR from 'swr';
import { type FetchResponse, openmrsFetch, restBaseUrl, useConfig, useSession } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { type ReportRow } from '../reports/report-dataset.resource';
import { matchesColumns } from '../table-filters/distinct-values';
import { type FilterDefaults, useUrlFilters } from '../table-filters/url-filters';

const keys = ['status', 'cardiac', 'primaryCare', 'category', 'bpg', 'flag', 'q'] as const;

export type RegistryFilters = Record<(typeof keys)[number], string>;

/** The report column each dropdown filter matches. */
export const registryFilterColumns = {
  status: 'enrollment_status',
  cardiac: 'cardiac_clinic',
  primaryCare: 'primary_care_clinic',
  category: 'diagnosis_category',
  bpg: 'bpg_status',
} as const;

/** Active patients, at the session location when it is a cardiac clinic, as the report names its clinics. */
function useRegistryDefaults(): FilterDefaults<(typeof keys)[number]> {
  const { clinicLocationTags } = useConfig<Config>();
  const { sessionLocation } = useSession();
  const { data, error } = useSWR<FetchResponse<{ tags: Array<{ display: string }> }>, Error>(
    sessionLocation?.uuid ? `${restBaseUrl}/location/${sessionLocation.uuid}?v=custom:(tags:(display))` : null,
    openmrsFetch,
  );
  if (sessionLocation?.uuid && !data && !error) {
    return 'pending';
  }
  const cardiac = data?.data?.tags?.some((tag) => clinicLocationTags.cardiac.includes(tag.display));
  return cardiac ? { status: 'Active', cardiac: sessionLocation.display } : { status: 'Active' };
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
        [row.full_name, row.rhd_id].some((value) =>
          String(value ?? '')
            .toLowerCase()
            .includes(q),
        )),
  );
}
