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
  const { data, error, mutate } = useSWR<FetchResponse<ProphylaxisSummary>, Error>(
    patientUuid ? `${restBaseUrl}/actcore/prophylaxis?patient=${patientUuid}` : null,
    openmrsFetch,
    // A user without Get Observations is refused every time, once per banner on a search page.
    { shouldRetryOnError: false },
  );

  return { summary: data?.data, error, mutate };
}
