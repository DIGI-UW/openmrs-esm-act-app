import useSWR from 'swr';
import dayjs from 'dayjs';
import { useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { fetchAll } from '../fetch-all';
import { answersTo, type PatientEncounter, patientEncountersUrl } from '../patient-encounters';

export interface BpgInjection {
  uuid: string;
  /** The day the injection was given, as YYYY-MM-DD, matching ACT Core's injection dates. */
  day: string;
  /** The Dose given answer's name; null for an injection saved before the form asked it. */
  dose: string | null;
  /** The Facility answer's location name, which REST resolves from the uuid the form saves, or its text; null without one. */
  facility: string | null;
  location: string | null;
  lateReasons: Array<string>;
}

const facilityName = (value: unknown) =>
  typeof value === 'object' && value !== null ? (value as { display: string }).display : String(value);

export interface OralEntry {
  uuid: string;
  date: string;
  weeks: number | null;
  adherence: number | null;
}

const representation = 'custom:(uuid,encounterDatetime,location:(display),obs:(concept:(uuid),value:(uuid,display)))';

export function useBpgInjections(patientUuid: string) {
  const { prophylaxisPage } = useConfig<Config>();
  const { concepts } = prophylaxisPage;
  const url = patientEncountersUrl(patientUuid, prophylaxisPage.bpgEncounterType, representation);
  const { data, error, isLoading } = useSWR<Array<BpgInjection>, Error>(url, async () => {
    const encounters = await fetchAll<PatientEncounter>(url);
    // The BPG form records no Date of Injection when BPG is withheld, so that visit is not an injection.
    const injections = encounters
      .filter((encounter) => answersTo(encounter, concepts.injectionDate).length)
      .map((encounter): BpgInjection => {
        const [date] = answersTo(encounter, concepts.injectionDate);
        const [dose] = answersTo(encounter, concepts.doseGiven);
        const [facility] = answersTo(encounter, concepts.facility);
        return {
          uuid: encounter.uuid,
          day: dayjs(String(date.value)).format('YYYY-MM-DD'),
          dose: dose ? (dose.value as { display: string }).display : null,
          facility: facility ? facilityName(facility.value) : null,
          location: encounter.location?.display ?? null,
          lateReasons: answersTo(encounter, concepts.lateReason).map((o) => (o.value as { display: string }).display),
        };
      });
    return injections.sort((a, b) => b.day.localeCompare(a.day));
  });
  return { injections: data ?? [], error, isLoading };
}

/** The patient's Oral Adherence reports, newest first; a null patient fetches nothing. */
export function useOralEntries(patientUuid: string | null) {
  const { prophylaxisPage } = useConfig<Config>();
  const { concepts } = prophylaxisPage;
  const url = patientEncountersUrl(patientUuid, prophylaxisPage.oralEncounterType, representation);
  const { data, error } = useSWR<Array<PatientEncounter>, Error>(patientUuid ? url : null, () =>
    fetchAll<PatientEncounter>(url),
  );
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
