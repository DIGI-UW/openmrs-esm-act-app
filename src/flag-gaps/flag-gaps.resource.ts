import useSWR from 'swr';
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

export async function fetchForm(formUuid: string) {
  const response = await openmrsFetch(`${restBaseUrl}/form/${formUuid}?v=${formRepresentation}`);
  return response.data;
}
