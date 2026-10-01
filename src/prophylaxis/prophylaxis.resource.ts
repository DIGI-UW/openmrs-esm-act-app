import useSWR from 'swr';
import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

/** null for an oral regimen whose supply end is unknown. */
export type ProphylaxisStatus = 'overdue' | 'dueToday' | 'dueSoon' | 'ok' | 'none' | null;

export interface ProphylaxisSummary {
  regimen: string | null;
  type: 'BPG' | 'Oral' | null;
  intervalDays: number | null;
  lastGiven: string | null;
  nextDue: string | null;
  status: ProphylaxisStatus;
  onTime: { given: number; total: number; months: number } | null;
}

export function useProphylaxisSummary(patientUuid: string | null) {
  const { data, error } = useSWR<FetchResponse<ProphylaxisSummary>, Error>(
    // Keyed under the patient's /encounter, which every form save invalidates, so a save refetches it.
    patientUuid ? `${restBaseUrl}/encounter?patient=${patientUuid}&for=actcore-prophylaxis` : null,
    () => openmrsFetch<ProphylaxisSummary>(`${restBaseUrl}/actcore/prophylaxis?patient=${patientUuid}`),
    // A user without Get Observations is refused every time, once per banner on a search page.
    { shouldRetryOnError: false },
  );

  return { summary: data?.data, error };
}
