import useSWR from 'swr';
import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

/** One piece of data missing behind a flag, as the rhdflags gap endpoint returns it. */
export interface FlagGap {
  encounter: string;
  encounterDatetime: string;
  form: { uuid: string; display: string } | null;
  concept: { uuid: string; display: string };
}

interface FlagGapsResponse {
  configured: boolean;
  results: Array<FlagGap>;
}

// The representation the patient chart's forms app opens a form with.
const formRepresentation =
  'custom:(uuid,name,display,encounterType:(uuid,name,viewPrivilege,editPrivilege),version,published,retired,resources:(uuid,name,dataType,valueReference))';

export function useFlagGaps(patientUuid: string, flagUuid: string) {
  const url = patientUuid && flagUuid ? `${restBaseUrl}/rhdflags/gap?patient=${patientUuid}&flag=${flagUuid}` : null;
  const { data, error, isLoading } = useSWR<FetchResponse<FlagGapsResponse>, Error>(url, openmrsFetch);

  return {
    gaps: data?.data?.results ?? [],
    configured: data?.data?.configured ?? false,
    isLoading,
    error,
  };
}

export async function fetchForm(formUuid: string) {
  const response = await openmrsFetch(`${restBaseUrl}/form/${formUuid}?v=${formRepresentation}`);
  return response.data;
}
