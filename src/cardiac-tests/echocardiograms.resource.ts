import useSWR from 'swr';
import { parseDate, useConfig } from '@openmrs/esm-framework';
import { type Config, type EchoField } from '../config-schema';
import { fetchAll } from '../fetch-all';
import { answersTo, type PatientEncounter, patientEncountersUrl } from '../patient-encounters';

export type Echocardiogram = { uuid: string; date: Date; otherFindings: Array<Finding> } & Partial<
  Record<Exclude<EchoField, 'date'>, unknown>
>;

/** An answer the table has no column for, named by its question. */
export interface Finding {
  question: string;
  answer: string;
}

export interface Electrocardiogram {
  uuid: string;
  date: Date;
  results: Array<string>;
  otherFinding: string | null;
}

const representation = 'custom:(uuid,encounterDatetime,obs:(concept:(uuid,display),value:(display)))';

const answerText = (value: unknown) =>
  typeof value === 'object' && value !== null ? String((value as { display?: string }).display ?? '') : String(value);

/** The patient's echocardiograms, newest first, each with its answers by field. */
export function useEchocardiograms(patientUuid: string) {
  const { cardiacTests } = useConfig<Config>();
  const url = patientEncountersUrl(patientUuid, cardiacTests.echoEncounterType, representation);
  const { data, error, isLoading } = useSWR<Array<PatientEncounter>, Error>(url, () => fetchAll<PatientEncounter>(url));
  const fields = Object.entries(cardiacTests.concepts) as Array<[EchoField, string]>;
  const echocardiograms = (data ?? [])
    .map((encounter): Echocardiogram => {
      const answers = Object.fromEntries(
        fields.map(([field, concept]) => [field, answersTo(encounter, concept)[0]?.value]),
      );
      const { date, ...findings } = answers;
      const columnConcepts = fields.map(([, concept]) => concept);
      const otherFindings = encounter.obs
        .filter((obs) => !columnConcepts.includes(obs.concept.uuid))
        .map((obs) => ({ question: obs.concept.display ?? '', answer: answerText(obs.value) }));
      return {
        uuid: encounter.uuid,
        date: parseDate(String(date ?? encounter.encounterDatetime)),
        otherFindings,
        ...findings,
      };
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  return { echocardiograms, error, isLoading };
}

/** The patient's electrocardiograms, newest first, with each finding the result records. */
export function useElectrocardiograms(patientUuid: string) {
  const { cardiacTests } = useConfig<Config>();
  const { ecgConcepts } = cardiacTests;
  const url = patientEncountersUrl(patientUuid, cardiacTests.ecgEncounterType, representation);
  const { data, error, isLoading } = useSWR<Array<PatientEncounter>, Error>(url, () => fetchAll<PatientEncounter>(url));
  const electrocardiograms = (data ?? [])
    .map((encounter): Electrocardiogram => {
      const [date] = answersTo(encounter, ecgConcepts.date);
      const [other] = answersTo(encounter, ecgConcepts.otherFinding);
      return {
        uuid: encounter.uuid,
        date: parseDate(String(date?.value ?? encounter.encounterDatetime)),
        results: answersTo(encounter, ecgConcepts.result).map((obs) => answerText(obs.value)),
        otherFinding: other ? answerText(other.value) : null,
      };
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  return { electrocardiograms, error, isLoading };
}
