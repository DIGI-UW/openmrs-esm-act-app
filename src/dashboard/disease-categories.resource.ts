import useSWR from 'swr';
import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { diagnosisConcepts } from '../consultations/patient-details.resource';

export interface DiseaseCategory {
  uuid: string;
  display: string;
}

export function useDiseaseCategories() {
  const { data, error, isLoading, mutate } = useSWR<FetchResponse<{ answers: Array<DiseaseCategory> }>, Error>(
    `${restBaseUrl}/concept/${diagnosisConcepts.category}?v=custom:(answers:(uuid,display))`,
    openmrsFetch,
  );
  // A failed reload keeps the answers it already has, so only a first load can fail.
  return {
    categories: data?.data.answers ?? [],
    error: data ? undefined : error,
    isLoading,
    retry: () => void mutate(),
  };
}
