import useSWR from 'swr';
import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

export interface RefreshStatus {
  /** When the last refresh finished, scheduled or on demand, as an ISO-8601 instant. */
  lastRefreshed: string | null;
  running: boolean;
  /** On a refresh's answer: false when another run was already in progress, so this one did not run. */
  refreshed?: boolean;
}

const refreshUrl = `${restBaseUrl}/actcore/refresh`;

export function useRefreshStatus() {
  const { data, error, isLoading, mutate } = useSWR<RefreshStatus, Error>(
    refreshUrl,
    async () => (await openmrsFetch<RefreshStatus>(refreshUrl)).data,
  );
  return { status: data, error, isLoading, mutate };
}

/** Runs ACT Core's flag and adherence refresh, and answers once it has finished. */
export async function runRefresh() {
  const { data } = await openmrsFetch<RefreshStatus>(refreshUrl, { method: 'POST' });
  return data;
}
