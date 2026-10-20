import useSWR, { type ScopedMutator } from 'swr';
import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

/** One piece of data missing behind a flag, as the ACT Core gap endpoint returns it. */
export interface FlagGap {
  encounter: string;
  encounterDatetime: string;
  form: { uuid: string; display: string } | null;
  concept: { uuid: string; display: string };
}

/** The gaps behind one of the patient's flags; `configured` is false for a flag with no gap query. */
export interface FlagGaps {
  flagUuid: string;
  flagName: string;
  configured: boolean;
  gaps: Array<FlagGap>;
}

interface FlagGapsResponse {
  configured: boolean;
  results: Array<FlagGap>;
}

interface PatientFlagsResponse {
  results: Array<{ voided: boolean; flag: { uuid: string; display: string } }>;
}

// The representation the patient chart's forms app opens a form with.
const formRepresentation =
  'custom:(uuid,name,display,encounterType:(uuid,name,viewPrivilege,editPrivilege),version,published,retired,resources:(uuid,name,dataType,valueReference))';

async function fetchFlagGaps(patientUuid: string, flagUuid: string, flagName: string): Promise<FlagGaps> {
  const { data } = await openmrsFetch<FlagGapsResponse>(
    `${restBaseUrl}/actcore/gap?patient=${patientUuid}&flag=${flagUuid}`,
  );
  return { flagUuid, flagName, configured: data.configured, gaps: data.results };
}

/** The patient's flags that are raised now, each once. */
async function fetchRaisedFlags(patientUuid: string) {
  const { data } = await openmrsFetch<PatientFlagsResponse>(
    `${restBaseUrl}/patientflags/patientflag?patient=${patientUuid}&v=custom:(voided,flag:(uuid,display))`,
  );
  const flags = new Map<string, string>();
  data.results.filter((row) => !row.voided).forEach((row) => flags.set(row.flag.uuid, row.flag.display));
  return [...flags].map(([uuid, name]) => ({ uuid, name }));
}

/**
 * The gaps behind the clicked flag, or, when the workspace was not told which flag was clicked, behind
 * every flag the patient has raised now.
 */
export function usePatientFlagGaps(patientUuid: string, clickedFlag?: { uuid: string; name: string }) {
  const { data, error, isLoading } = useSWR<Array<FlagGaps>, Error>(
    patientUuid ? ['rhd-flag-gaps', patientUuid, clickedFlag?.uuid ?? 'every raised flag'] : null,
    async () => {
      const flags = clickedFlag ? [clickedFlag] : await fetchRaisedFlags(patientUuid);
      return Promise.all(flags.map((flag) => fetchFlagGaps(patientUuid, flag.uuid, flag.name)));
    },
  );

  return { flagGaps: data ?? [], isLoading, error };
}

/** One of the patient's raised flags as ACT Core keeps it: since when it is raised, and whether the user may dismiss it. */
export interface RaisedFlag {
  flag: string;
  display: string;
  raisedSince: string | null;
  dismissible: boolean;
}

export function useRaisedFlags(patientUuid: string) {
  const { data, error, isLoading } = useSWR<Array<RaisedFlag>, Error>(
    patientUuid ? ['act-raised-flags', patientUuid] : null,
    async () => {
      const { data } = await openmrsFetch<{ results: Array<RaisedFlag> }>(
        `${restBaseUrl}/actcore/raisedflags?patient=${patientUuid}`,
      );
      return data.results;
    },
  );
  return { raisedFlags: data ?? [], isLoading, error };
}

/**
 * Dismisses the flag for the patient until the data no longer raises it, then reloads what lists the patient's
 * flags (the banner's and this workspace's) and Next steps, which a dismissed flag no longer raises. `mutate` is the caller's `useSWRConfig().mutate`: O3 gives every extension
 * one SWR cache through a provider, which swr's own global `mutate` does not reach.
 */
export async function dismissFlag(patientUuid: string, flagUuid: string, mutate: ScopedMutator) {
  await openmrsFetch(`${restBaseUrl}/actcore/raisedflags/dismiss`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { patient: patientUuid, flag: flagUuid },
  });
  const patientFlags = `${restBaseUrl}/patientflags/patientflag?patient=${patientUuid}`;
  const nextSteps = `${restBaseUrl}/encounter?patient=${patientUuid}&for=actcore-nextsteps`;
  await mutate(
    (key) =>
      (typeof key === 'string' && (key.startsWith(patientFlags) || key === nextSteps)) ||
      (Array.isArray(key) && ['rhd-flag-gaps', 'act-raised-flags'].includes(key[0]) && key[1] === patientUuid),
  );
}

export async function fetchForm(formUuid: string) {
  const response = await openmrsFetch(`${restBaseUrl}/form/${formUuid}?v=${formRepresentation}`);
  return response.data;
}
