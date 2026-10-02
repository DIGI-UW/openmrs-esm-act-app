import useSWR from 'swr';
import { type FetchResponse, openmrsFetch, restBaseUrl, useSession } from '@openmrs/esm-framework';

export interface SearchedPatient {
  uuid: string;
  person: { display: string; gender: string; age: number | null; birthdate: string | null };
  identifiers: Array<{ identifier: string; identifierType: { uuid: string } }>;
}

const patientRepresentation =
  'custom:(uuid,person:(display,gender,age,birthdate),identifiers:(identifier,identifierType:(uuid)))';

export const searchPageSize = 10;

/** Patients whose name or identifier matches the term, as the REST patient search finds them. */
export function usePatientSearch(term: string) {
  const query = term.trim();
  const { data, error, isLoading } = useSWR<
    FetchResponse<{ results: Array<SearchedPatient>; totalCount?: number }>,
    Error
  >(
    query.length >= 2
      ? `${restBaseUrl}/patient?q=${encodeURIComponent(query)}&v=${patientRepresentation}&limit=${searchPageSize}&totalCount=true`
      : null,
    openmrsFetch,
  );
  const patients = data?.data.results ?? [];
  return { patients, totalCount: data?.data.totalCount ?? patients.length, error, isLoading };
}

const userPropertiesUrl = (userUuid: string) => `${restBaseUrl}/user/${userUuid}?v=custom:(userProperties)`;

/**
 * The patients the user viewed most recently, from the user property O3's patient search keeps, so ACT's
 * search and O3's share one list.
 */
export function useRecentlyViewedPatients() {
  const { user } = useSession();
  const { data: properties, mutate } = useSWR<FetchResponse<{ userProperties: Record<string, string> }>, Error>(
    user?.uuid ? userPropertiesUrl(user.uuid) : null,
    openmrsFetch,
  );
  const userProperties = properties?.data.userProperties ?? {};
  const uuids = (userProperties.patientsVisited ?? '').split(',').filter(Boolean);
  const { data: patients, isLoading } = useSWR<Array<SearchedPatient>, Error>(
    uuids.length ? ['act-recently-viewed', ...uuids] : null,
    () =>
      Promise.all(
        uuids.map((uuid) =>
          openmrsFetch<SearchedPatient>(`${restBaseUrl}/patient/${uuid}?v=${patientRepresentation}`).then(
            ({ data }) => data,
            () => null,
          ),
        ),
      ).then((found) => found.filter(Boolean)),
  );

  const addRecentlyViewed = async (patientUuid: string) => {
    // The POST replaces every user property, so none is sent before they load.
    if (!user?.uuid || !properties) {
      return;
    }
    // Ten, most recent first, as O3's patient search keeps them.
    const patientsVisited = [patientUuid, ...uuids.filter((uuid) => uuid !== patientUuid)].slice(0, 10).join(',');
    await openmrsFetch(`${restBaseUrl}/user/${user.uuid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { userProperties: { ...userProperties, patientsVisited } },
    });
    mutate();
  };

  return {
    patients: uuids.length ? (patients ?? []) : [],
    isLoading: Boolean(uuids.length) && isLoading,
    addRecentlyViewed,
  };
}
