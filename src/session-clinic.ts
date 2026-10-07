import useSWR from 'swr';
import { type FetchResponse, openmrsFetch, restBaseUrl, useConfig, useSession } from '@openmrs/esm-framework';
import { type Config } from './config-schema';

export type SessionClinicKind = 'pending' | 'error' | 'cardiac' | 'primaryCare' | 'none';

/**
 * What kind of clinic the session location is, from its tags and the configured clinic tags: a cardiac clinic,
 * a primary care clinic, or neither. 'none' too when no location is chosen.
 */
export function useSessionClinicKind(): SessionClinicKind {
  const { clinicLocationTags } = useConfig<Config>();
  const { sessionLocation } = useSession();
  const { data, error } = useSWR<FetchResponse<{ tags: Array<{ display: string }> }>, Error>(
    sessionLocation?.uuid ? `${restBaseUrl}/location/${sessionLocation.uuid}?v=custom:(tags:(display))` : null,
    openmrsFetch,
  );
  if (!sessionLocation?.uuid) {
    return 'none';
  }
  // A failed refresh keeps the kind already known, as SWR keeps its data.
  if (!data) {
    return error ? 'error' : 'pending';
  }
  const tags = data.data?.tags?.map((tag) => tag.display) ?? [];
  if (tags.some((tag) => clinicLocationTags.cardiac.includes(tag))) {
    return 'cardiac';
  }
  if (tags.some((tag) => clinicLocationTags.primaryCare.includes(tag))) {
    return 'primaryCare';
  }
  return 'none';
}
