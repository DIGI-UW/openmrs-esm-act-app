import useSWR from 'swr';
import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { fetchAll } from '../fetch-all';

/** The patient list rhdflags keeps for one flag, with the patients on it now. */
export interface RhdFlagList {
  cohortUuid: string | null;
  flagName: string;
  priority: 'risk' | 'dataQuality';
  memberCount: number;
  /** Present when the lists were asked for with their members. */
  memberUuids?: ReadonlySet<string>;
}

/** Lists are read as cohorts: the flags themselves are readable only with privileges that run SQL. */
function searchLists(text: string) {
  return fetchAll<{ uuid: string; name: string; voided: boolean }>(
    `${restBaseUrl}/cohort?q=${encodeURIComponent(text)}&v=custom:(uuid,name,voided)`,
  ).then((lists) => lists.filter((list) => !list.voided));
}

/** Counts memberships that have not ended; the count also takes in memberships voided along with their patient. */
async function countMembers(cohortUuid: string) {
  const { data } = await openmrsFetch<{ totalCount: number }>(
    `${restBaseUrl}/cohortm/cohortmember?cohort=${cohortUuid}&v=custom:(uuid)&limit=1&totalCount=true`,
  );
  return data.totalCount;
}

/** The cohort module returns only memberships that have not ended. */
async function fetchMemberUuids(cohortUuid: string) {
  const members = await fetchAll<{ patient: { uuid: string }; voided: boolean }>(
    `${restBaseUrl}/cohortm/cohortmember?cohort=${cohortUuid}&v=custom:(patient:(uuid),voided)`,
  );
  return new Set(members.filter((member) => !member.voided).map((member) => member.patient.uuid));
}

async function findLists({ names, namePrefix }: Config['flagLists']) {
  if (names.length) {
    const found = await Promise.all(names.map(async (name) => (await searchLists(name)).find((l) => l.name === name)));
    return names.map((name, i) => ({ name, uuid: found[i]?.uuid ?? null }));
  }
  return (await searchLists(namePrefix)).filter((list) => list.name.startsWith(namePrefix));
}

/**
 * The configured RHD flag lists, each with its current patient count, and its patients when `withMembers` is set.
 * The cohort module loads a whole list on the server for every page it returns, so ask for members only where needed.
 */
export function useRhdFlagLists({ withMembers = false } = {}) {
  const { flagLists } = useConfig<Config>();
  const { data, error, isLoading } = useSWR<Array<RhdFlagList>, Error>(
    ['rhd-flag-lists', flagLists, withMembers],
    async () => {
      const lists = await findLists(flagLists);
      return Promise.all(
        lists.map(async (list): Promise<RhdFlagList> => {
          const common = {
            cohortUuid: list.uuid,
            flagName: list.name,
            priority: flagLists.riskFlags.includes(list.name) ? 'risk' : 'dataQuality',
          } as const;
          if (!withMembers) {
            return { ...common, memberCount: list.uuid ? await countMembers(list.uuid) : 0 };
          }
          const memberUuids = list.uuid ? await fetchMemberUuids(list.uuid) : new Set<string>();
          return { ...common, memberCount: memberUuids.size, memberUuids };
        }),
      );
    },
    // rhdflags updates the lists daily, so a screen mounting again reuses the cached lists.
    { revalidateIfStale: false },
  );

  return { lists: data ?? [], isLoading, error };
}

/** The lists the patient is on now, among lists fetched with their members. */
export function listsForPatient(lists: Array<RhdFlagList>, patientUuid: string) {
  return lists.filter((list) => list.memberUuids?.has(patientUuid));
}
