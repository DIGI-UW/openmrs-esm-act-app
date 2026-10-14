import useSWR from 'swr';
import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

export interface StudyState {
  uuid: string;
  name: string;
  initial: boolean;
  /** An Inactive status, which completes the enrolment. */
  terminal: boolean;
}

/** A research study: a program whose Study status workflow ACT Core copied from the template. */
export interface Study {
  uuid: string;
  name: string;
  states: Array<StudyState>;
}

const studiesUrl = `${restBaseUrl}/actcore/studies`;

export function useStudies() {
  const { data, error, isLoading, mutate } = useSWR<Array<Study>, Error>(
    studiesUrl,
    async () => (await openmrsFetch<{ results: Array<Study> }>(studiesUrl)).data.results,
  );
  return { studies: data ?? [], error, isLoading, mutate };
}

/** Creates a study, or renames the one given. */
export async function saveStudy(name: string, uuid?: string) {
  const { data } = await openmrsFetch<Study>(uuid ? `${studiesUrl}/${uuid}` : studiesUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { name },
  });
  return data;
}
