import useSWR from 'swr';
import { parseDate, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import { type Config, type EchoField } from '../config-schema';
import { fetchAll } from '../fetch-all';

interface EchoEncounter {
  uuid: string;
  encounterDatetime: string;
  obs: Array<{ concept: { uuid: string }; value: unknown }>;
}

export type Echocardiogram = { uuid: string; date: Date } & Partial<Record<Exclude<EchoField, 'date'>, unknown>>;

/** The patient's echocardiograms, newest first, each with its answers by field. */
export function useEchocardiograms(patientUuid: string) {
  const { cardiacTests } = useConfig<Config>();
  // Under the patient's /encounter, which common-lib's invalidatePatientEncounters revalidates after a form is saved.
  const url =
    `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${cardiacTests.echoEncounterType}` +
    '&v=custom:(uuid,encounterDatetime,obs:(concept:(uuid),value:(display)))';
  const { data, error, isLoading } = useSWR<Array<EchoEncounter>, Error>(url, () => fetchAll<EchoEncounter>(url));
  const fields = Object.entries(cardiacTests.concepts) as Array<[EchoField, string]>;
  const echocardiograms = (data ?? [])
    .map((encounter): Echocardiogram => {
      const answers = Object.fromEntries(
        fields.map(([field, concept]) => [field, encounter.obs.find((o) => o.concept.uuid === concept)?.value]),
      );
      const { date, ...findings } = answers;
      return { uuid: encounter.uuid, date: parseDate(String(date ?? encounter.encounterDatetime)), ...findings };
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  return { echocardiograms, error, isLoading };
}
