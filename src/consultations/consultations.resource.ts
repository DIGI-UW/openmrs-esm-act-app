import useSWR from 'swr';
import dayjs from 'dayjs';
import { parseDate, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { fetchAll } from '../fetch-all';

/** An answer with its question, and the answers grouped under it. */
export interface GroupedObs {
  uuid?: string;
  concept: { uuid: string; display?: string };
  value: unknown;
  groupMembers?: Array<GroupedObs> | null;
}

export interface ChartEncounter {
  uuid: string;
  encounterDatetime: string;
  encounterProviders?: Array<{ provider?: { display?: string } | null }> | null;
  obs: Array<GroupedObs>;
}

// Two levels of groupMembers, for a group inside a group such as an allergy's Reaction. One representation for every
// reader, so the SWR readers of a type share one fetch per patient.
export const representation =
  'custom:(uuid,encounterDatetime,encounterProviders:(provider:(display)),obs:(uuid,concept:(uuid,display),value,groupMembers:(uuid,concept:(uuid,display),value,groupMembers:(uuid,concept:(uuid,display),value))))';

/** A coded answer's name, or a plain answer as text. */
export const answerText = (value: unknown) =>
  typeof value === 'object' && value !== null
    ? String((value as { display?: string }).display ?? '')
    : String(value ?? '');

export const answerUuid = (value: unknown) =>
  typeof value === 'object' && value !== null ? String((value as { uuid?: string }).uuid ?? '') : '';

/** The answers to a question, among the encounter's top-level answers or a group's members. */
export const answersIn = (obs: Array<GroupedObs> | null | undefined, concept: string) =>
  (obs ?? []).filter((one) => one.concept.uuid === concept);

// Under the patient's /encounter, which common-lib revalidates after a form is saved.
const encountersUrl = (patientUuid: string, encounterType: string) =>
  `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${encounterType}&v=${representation}`;

/** Every encounter of one type for a patient, with each answer group's members, outside a component. */
export const fetchChartEncounters = (patientUuid: string, encounterType: string) =>
  fetchAll<ChartEncounter>(encountersUrl(patientUuid, encounterType));

/** A patient's encounters of one type, newest first, with each answer group's members. */
export function useChartEncounters(patientUuid: string | null, encounterType: string) {
  const url = patientUuid ? encountersUrl(patientUuid, encounterType) : null;
  const { data, error, isLoading } = useSWR<Array<ChartEncounter>, Error>(url, () => fetchAll<ChartEncounter>(url));
  const encounters = [...(data ?? [])].sort(
    (a, b) => parseDate(b.encounterDatetime).getTime() - parseDate(a.encounterDatetime).getTime(),
  );
  return { encounters, error, isLoading };
}

export interface Consultation {
  uuid: string;
  date: Date;
  seenBy: string;
  nyha: string;
  plan: string;
  nextReview: Date | null;
}

const periodUnits: Record<string, dayjs.ManipulateType> = {
  '1072AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': 'day',
  '1073AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': 'week',
  '1074AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': 'month',
  '1734AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': 'year',
};

/**
 * One consultation as the Consultation visits page lists it: its date, who saw the patient, the NYHA class, the
 * prophylaxis plan (each regimen, and whether it was stopped) and the next review its Next Consultation Time sets.
 */
export function toConsultation(encounter: ChartEncounter, concepts: Config['consultations']['concepts']): Consultation {
  const [dateAnswer] = answersIn(encounter.obs, concepts.date);
  const date = parseDate(String(dateAnswer?.value ?? encounter.encounterDatetime));
  const plan = answersIn(encounter.obs, concepts.prophylaxis)
    .map((group) => {
      const [regimen] = answersIn(group.groupMembers, concepts.prophylaxis);
      if (!regimen) {
        return null;
      }
      const stopped = answersIn(group.groupMembers, concepts.dateStopped).length > 0;
      return stopped ? `${answerText(regimen.value)} (stopped)` : answerText(regimen.value);
    })
    .filter(Boolean)
    .join('; ');
  const [amount] = answersIn(encounter.obs, concepts.nextAmount);
  const [period] = answersIn(encounter.obs, concepts.nextPeriod);
  const unit = period ? periodUnits[answerUuid(period.value)] : undefined;
  const nextReview =
    amount && unit
      ? dayjs(parseDate(encounter.encounterDatetime))
          .add(Math.round(Number(amount.value)), unit)
          .toDate()
      : null;
  return {
    uuid: encounter.uuid,
    date,
    seenBy: (encounter.encounterProviders ?? [])
      .map((one) => one.provider?.display?.replace(/^.* - /, '') ?? '')
      .filter(Boolean)
      .join(', '),
    nyha: answerText(answersIn(encounter.obs, concepts.nyha)[0]?.value ?? ''),
    plan,
    nextReview,
  };
}

/** The patient's consultations, newest first. */
export function useConsultations(patientUuid: string | null) {
  const { consultations } = useConfig<Config>();
  const { encounters, error, isLoading } = useChartEncounters(patientUuid, consultations.encounterType);
  return {
    consultations: encounters.map((encounter) => toConsultation(encounter, consultations.concepts)),
    encounters,
    error,
    isLoading,
  };
}
