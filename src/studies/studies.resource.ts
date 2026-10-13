import useSWR from 'swr';
import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

export interface FacilityRollup {
  facility: string | null;
  patients: number;
  /** Mean of the per-patient adherence the nightly refresh wrote, null when none has one. */
  adherence: number | null;
}

const url = `${restBaseUrl}/actcore/registry/by-facility`;

/** The registry's active enrolments grouped by the facility they were taken at. */
export function useRegistryByFacility() {
  const { data, error, isLoading } = useSWR<FetchResponse<{ results: Array<FacilityRollup> }>, Error>(
    url,
    openmrsFetch,
    { shouldRetryOnError: false },
  );
  return { rows: data?.data?.results ?? [], isLoading, error };
}
