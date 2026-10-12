import { formatDate, restBaseUrl } from '@openmrs/esm-framework';

export interface PatientEncounter {
  uuid: string;
  encounterDatetime: string;
  location?: { display: string } | null;
  encounterProviders?: Array<{ provider: { name?: string | null; person?: { display: string } | null } }>;
  obs: Array<{ concept: { uuid: string; display?: string }; value: unknown }>;
}

/** A patient's encounters of one type, under their /encounter, which common-lib revalidates after a form is saved. */
export const patientEncountersUrl = (patientUuid: string, encounterType: string, representation: string) =>
  `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${encounterType}&v=${representation}`;

/** The encounter's answers to one question; a multiple-choice question has one per answer chosen. */
export const answersTo = (encounter: PatientEncounter, concept: string) =>
  encounter.obs.filter((obs) => obs.concept.uuid === concept);

/** An answer, or a group of them, as a representation with groupMembers returns it. */
export type Obs = PatientEncounter['obs'][number] & { groupMembers?: Array<Obs> | null };

/** A coded answer by its name; any other answer as it is. */
export const answerText = (value: unknown) =>
  typeof value === 'object' && value !== null ? String((value as { display?: string }).display ?? '') : String(value);

/** A coded answer's uuid. */
export const answerUuid = (value: unknown) => (value as { uuid?: string } | null)?.uuid;

/** The members of the encounter's groups for the question, each group with its own member answering it. */
export function groupsOf(encounter: PatientEncounter, concept: string) {
  return (answersTo(encounter, concept) as Array<Obs>)
    .filter((obs) => obs.groupMembers?.length)
    .map((group) => group.groupMembers);
}

/** A group's answer to one question. */
export const memberValue = (members: Array<Obs>, concept: string) =>
  members.find((member) => member.concept.uuid === concept)?.value;

/** A date as a chart's table or card shows it, without the time; null when there is none. */
export const day = (date: Date | null) => (date ? formatDate(date, { time: false }) : null);
