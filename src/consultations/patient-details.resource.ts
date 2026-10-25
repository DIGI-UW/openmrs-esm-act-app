import useSWR from 'swr';
import { type FetchResponse, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { answersIn, answerText, type GroupedObs, useChartEncounters } from './consultations.resource';

interface PersonDetails {
  attributes?: Array<{ attributeType: { uuid: string }; value: unknown }>;
  preferredAddress?: { cityVillage?: string | null } | null;
}

/** The patient's person attributes by type uuid, as text, and their village. */
export function usePersonDetails(patientUuid: string | null) {
  const { data, error, isLoading } = useSWR<FetchResponse<PersonDetails>, Error>(
    patientUuid
      ? `${restBaseUrl}/person/${patientUuid}?v=custom:(attributes:(attributeType:(uuid),value),preferredAddress:(cityVillage))`
      : null,
    openmrsFetch,
  );
  const attributes = new Map(
    (data?.data?.attributes ?? []).map((attribute) => [attribute.attributeType.uuid, answerText(attribute.value)]),
  );
  return { attributes, village: data?.data?.preferredAddress?.cityVillage ?? null, error, isLoading };
}

/** The Patient Information questions a diagnosis reads. */
export const diagnosisConcepts = {
  encounterType: 'ffdc883f-f99f-496a-83f9-2c3c581e1af0',
  group: '594b4495-36dc-52a6-9810-15a9e2e2dcb9',
  category: '1a5aa050-661d-5e89-95d7-c1eba476df22',
  priority: '97c025b2-f42c-5c53-8aaa-0506c8dd3774',
  active: 'b1b5d279-8013-5ae4-83a7-0f2bd9bc8457',
  started: '62321320-695e-5319-a306-40dfd6ad94b7',
  ended: 'e9f2fceb-05be-577f-bf76-dde0647f01db',
  details: [
    'cfe17bb5-4a76-5f3a-9e1c-7b1e9b84a8e3',
    'd3f6e1a2-9c5b-5e84-8f2d-1a6c7b9e0d4f',
    'b7a2c4d8-5e91-5f3a-8c6d-2b9e4f7a1c0d',
    'e9f3a5c7-6b82-5d4e-9f1a-3c7d8e2b5f4a',
  ],
};

/**
 * The diagnosis of the patient's latest Patient Information, as the registry reads it: the first Diagnosis with a
 * Category, and its details in name order. Null with none.
 */
export function useLatestDiagnosis(patientUuid: string | null) {
  const { encounters, error, isLoading } = useChartEncounters(patientUuid, diagnosisConcepts.encounterType);
  const group = encounters
    .flatMap((encounter) => answersIn(encounter.obs, diagnosisConcepts.group))
    .find((one) => answersIn(one.groupMembers, diagnosisConcepts.category).length);
  if (!group) {
    return { diagnosis: null, error, isLoading };
  }
  const category = answerText(answersIn(group.groupMembers, diagnosisConcepts.category)[0].value);
  const details = (group.groupMembers ?? [])
    .filter((member) => diagnosisConcepts.details.includes(member.concept.uuid))
    .map((member) => answerText(member.value))
    .sort();
  return { diagnosis: details.length ? `${category} (${details.join(', ')})` : category, error, isLoading };
}

export interface DiagnosisRow {
  key: string;
  diagnosis: string;
  priority: string;
  active: string;
  started: string | null;
  ended: string | null;
}

/** One Diagnosis answer group as a table row: the category with its details, and its priority, status and dates. */
export function toDiagnosisRow(group: GroupedObs, key: string): DiagnosisRow {
  const one = (concept: string) => answersIn(group.groupMembers, concept)[0]?.value;
  const category = answerText(one(diagnosisConcepts.category));
  const details = (group.groupMembers ?? [])
    .filter((member) => diagnosisConcepts.details.includes(member.concept.uuid))
    .map((member) => answerText(member.value))
    .sort();
  return {
    key,
    diagnosis: details.length ? `${category} (${details.join(', ')})` : category,
    priority: answerText(one(diagnosisConcepts.priority)),
    active: answerText(one(diagnosisConcepts.active)),
    started: one(diagnosisConcepts.started) ? String(one(diagnosisConcepts.started)) : null,
    ended: one(diagnosisConcepts.ended) ? String(one(diagnosisConcepts.ended)) : null,
  };
}

/** Every Diagnosis of the patient's Patient Information records that has a Category, latest record first. */
export function useDiagnoses(patientUuid: string | null) {
  const { encounters, error, isLoading } = useChartEncounters(patientUuid, diagnosisConcepts.encounterType);
  const diagnoses = encounters.flatMap((encounter) =>
    answersIn(encounter.obs, diagnosisConcepts.group)
      .filter((group) => answersIn(group.groupMembers, diagnosisConcepts.category).length)
      .map((group, index) => toDiagnosisRow(group, `${encounter.uuid}-${index}`)),
  );
  return { diagnoses, error, isLoading };
}
