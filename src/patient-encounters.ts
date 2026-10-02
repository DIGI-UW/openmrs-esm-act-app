import { restBaseUrl } from '@openmrs/esm-framework';

export interface PatientEncounter {
  uuid: string;
  encounterDatetime: string;
  location?: { display: string } | null;
  obs: Array<{ concept: { uuid: string }; value: unknown }>;
}

/** A patient's encounters of one type, under their /encounter, which common-lib revalidates after a form is saved. */
export const patientEncountersUrl = (patientUuid: string, encounterType: string, representation: string) =>
  `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${encounterType}&v=${representation}`;

/** The encounter's answers to one question; a multiple-choice question has one per answer chosen. */
export const answersTo = (encounter: PatientEncounter, concept: string) =>
  encounter.obs.filter((obs) => obs.concept.uuid === concept);
