import useSWR from 'swr';
import { type FetchResponse, openmrsFetch, restBaseUrl, useConfig, useSession } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';

/**
 * The report's clinic parameter for the session location, decided by its tags as the registry decides its
 * default: a cardiac clinic's patients, a primary care clinic's, or everyone's at a location that is neither.
 * Undefined while the location's tags load.
 */
export function useProgrammeScope(): Record<string, string> | undefined {
  const { clinicLocationTags } = useConfig<Config>();
  const { sessionLocation } = useSession();
  const { data, error } = useSWR<FetchResponse<{ tags: Array<{ display: string }> }>, Error>(
    sessionLocation?.uuid ? `${restBaseUrl}/location/${sessionLocation.uuid}?v=custom:(tags:(display))` : null,
    openmrsFetch,
  );
  if (sessionLocation?.uuid && !data && !error) {
    return undefined;
  }
  const tags = data?.data?.tags?.map((tag) => tag.display) ?? [];
  if (tags.some((tag) => clinicLocationTags.cardiac.includes(tag))) {
    return { cardiacClinic: sessionLocation.uuid };
  }
  if (tags.some((tag) => clinicLocationTags.primaryCare.includes(tag))) {
    return { primaryCareClinic: sessionLocation.uuid };
  }
  return {};
}
