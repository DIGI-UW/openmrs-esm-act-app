import useSWR from 'swr';
import { parseDate, useConfig } from '@openmrs/esm-framework';
import { type Config, type EchoField } from '../config-schema';
import { fetchAll } from '../fetch-all';
import { answersTo, type PatientEncounter, patientEncountersUrl } from '../patient-encounters';

export type Echocardiogram = { uuid: string; date: Date } & Partial<Record<Exclude<EchoField, 'date'>, unknown>>;

/** The patient's echocardiograms, newest first, each with its answers by field. */
export function useEchocardiograms(patientUuid: string) {
  const { cardiacTests } = useConfig<Config>();
  const url = patientEncountersUrl(
    patientUuid,
    cardiacTests.echoEncounterType,
    'custom:(uuid,encounterDatetime,obs:(concept:(uuid),value:(display)))',
  );
  const { data, error, isLoading } = useSWR<Array<PatientEncounter>, Error>(url, () => fetchAll<PatientEncounter>(url));
  const fields = Object.entries(cardiacTests.concepts) as Array<[EchoField, string]>;
  const echocardiograms = (data ?? [])
    .map((encounter): Echocardiogram => {
      const answers = Object.fromEntries(
        fields.map(([field, concept]) => [field, answersTo(encounter, concept)[0]?.value]),
      );
      const { date, ...findings } = answers;
      return { uuid: encounter.uuid, date: parseDate(String(date ?? encounter.encounterDatetime)), ...findings };
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  return { echocardiograms, error, isLoading };
}
