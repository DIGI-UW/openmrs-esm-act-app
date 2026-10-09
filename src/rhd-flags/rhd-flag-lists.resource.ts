import useSWR from 'swr';
import { restBaseUrl } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { fetchAll } from '../fetch-all';

/** The patient list ACT Core keeps for one flag, with the patients on it now. */
export interface RhdFlagList {
  cohortUuid: string | null;
  flagName: string;
  priority: 'risk' | 'dataQuality';
  memberCount: number;
}

/** Lists are read as cohorts: the flags themselves are readable only with privileges that run SQL. */
function searchLists(text: string) {
  return fetchAll<{ uuid: string; name: string; voided: boolean }>(
    `${restBaseUrl}/cohort?q=${encodeURIComponent(text)}&v=custom:(uuid,name,voided)`,
  ).then((lists) => lists.filter((list) => !list.voided));
}

/** Whether the flag is one of the configured RHD flags: named in names, or else starting with namePrefix. */
export function isListedFlag({ names, namePrefix }: Config['flagLists'], flagName: string) {
  return names.length ? names.includes(flagName) : flagName.startsWith(namePrefix);
}

export function flagPriority({ riskFlags }: Config['flagLists'], flagName: string): RhdFlagList['priority'] {
  return riskFlags.includes(flagName) ? 'risk' : 'dataQuality';
}

/** The list ACT Core keeps for the flag with this name; no list when the flag has none. */
export function useRhdFlagList(flagName: string) {
  const { data, error, isLoading } = useSWR<{ cohortUuid: string } | null, Error>(
    flagName ? ['rhd-flag-list', flagName] : null,
    async () => {
      const list = (await searchLists(flagName)).find((l) => l.name === flagName);
      return list ? { cohortUuid: list.uuid } : null;
    },
    { revalidateIfStale: false },
  );
  return { list: data ?? null, isLoading, error };
}
