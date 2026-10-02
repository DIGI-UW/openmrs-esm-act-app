import useSWR from 'swr';
import useSWRImmutable from 'swr/immutable';
import dayjs from 'dayjs';
import { type FetchResponse, openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { fetchAll } from '../fetch-all';
import { answersTo, type PatientEncounter, patientEncountersUrl } from '../patient-encounters';
import { isUuid } from '../uuid';

export interface BpgInjection {
  uuid: string;
  /** The day the injection was given, as YYYY-MM-DD, matching ACT Core's injection dates. */
  day: string;
  /** The Facility answer as recorded, a location's uuid or text; null without one. */
  facility: string | null;
  location: string | null;
  lateReasons: Array<string>;
}

export interface OralEntry {
  uuid: string;
  date: string;
  weeks: number | null;
  adherence: number | null;
}

const representation = 'custom:(uuid,encounterDatetime,location:(display),obs:(concept:(uuid),value:(uuid,display)))';

/** A Facility answer's location name; the recorded value when it is not a location's uuid or the lookup fails; null while it loads. */
export function useFacilityName(value: string | null) {
  const url = value && isUuid(value) ? `${restBaseUrl}/location/${value}?v=custom:(display)` : null;
  const { data, error } = useSWRImmutable<FetchResponse<{ display: string }>, Error>(url, openmrsFetch);
  return url && !error ? (data?.data.display ?? null) : value;
}

export function useBpgInjections(patientUuid: string) {
  const { prophylaxisPage } = useConfig<Config>();
  const { concepts } = prophylaxisPage;
  const url = patientEncountersUrl(patientUuid, prophylaxisPage.bpgEncounterType, representation);
  const { data, error, isLoading } = useSWR<Array<BpgInjection>, Error>(url, async () => {
    const encounters = await fetchAll<PatientEncounter>(url);
    const injections = encounters.map((encounter): BpgInjection => {
      const [date] = answersTo(encounter, concepts.injectionDate);
      const [facility] = answersTo(encounter, concepts.facility);
      return {
        uuid: encounter.uuid,
        day: dayjs(String(date?.value ?? encounter.encounterDatetime)).format('YYYY-MM-DD'),
        facility: facility ? String(facility.value) : null,
        location: encounter.location?.display ?? null,
        lateReasons: answersTo(encounter, concepts.lateReason).map((o) => (o.value as { display: string }).display),
      };
    });
    return injections.sort((a, b) => b.day.localeCompare(a.day));
  });
  return { injections: data ?? [], error, isLoading };
}

export function useOralEntries(patientUuid: string) {
  const { prophylaxisPage } = useConfig<Config>();
  const { concepts } = prophylaxisPage;
  const url = patientEncountersUrl(patientUuid, prophylaxisPage.oralEncounterType, representation);
  const { data, error } = useSWR<Array<PatientEncounter>, Error>(url, () => fetchAll<PatientEncounter>(url));
  const number = (encounter: PatientEncounter, concept: string) => {
    const [obs] = answersTo(encounter, concept);
    return obs == null ? null : Number(obs.value);
  };
  const entries = (data ?? [])
    .map(
      (encounter): OralEntry => ({
        uuid: encounter.uuid,
        date: encounter.encounterDatetime,
        weeks: number(encounter, concepts.weeks),
        adherence: number(encounter, concepts.adherence),
      }),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  return { entries, error };
}
