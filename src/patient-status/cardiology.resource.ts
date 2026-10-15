import useSWR from 'swr';
import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

/** The next cardiology review, as the registry dates it; null off the registry or with no review date recorded. */
export function useNextCardiologyVisit(patientUuid: string | null) {
  const { data, error } = useSWR<FetchResponse<{ nextDue: string | null }>, Error>(
    // Keyed under the patient's /encounter, so a saved consultation revalidates it as it does the prophylaxis summary.
    patientUuid ? `${restBaseUrl}/encounter?patient=${patientUuid}&for=actcore-cardiology` : null,
    () => openmrsFetch<{ nextDue: string | null }>(`${restBaseUrl}/actcore/cardiology?patient=${patientUuid}`),
    { shouldRetryOnError: false },
  );

  return { nextDue: data?.data?.nextDue ?? null, error };
}
