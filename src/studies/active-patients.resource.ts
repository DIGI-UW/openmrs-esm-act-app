import useSWR from 'swr';
import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

/**
 * The count of patients actively enrolled in actcore's configured registry program, from the backend
 * module's /actcore/registry/count endpoint. A failure is not retried.
 */
export function useActivePatientCount() {
  const { data, error, isLoading } = useSWR(
    'act-studies-active-patients',
    async () => {
      const { data } = await openmrsFetch<{ count: number }>(`${restBaseUrl}/actcore/registry/count`);
      return data.count;
    },
    { shouldRetryOnError: false },
  );
  return { count: data, isLoading, error };
}
