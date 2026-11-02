import useSWR from 'swr';
import { type FetchResponse, openmrsFetch, parseDate, restBaseUrl } from '@openmrs/esm-framework';
import {
  answersIn,
  answerText,
  type ChartEncounter,
  type GroupedObs,
  useChartEncounters,
} from './consultations.resource';

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

/**
 * The questions a diagnosis reads. A clinician records it on the RHD Consultation Visit (AR-167); one a Patient
 * Information recorded before then still counts, so both encounter types are read.
 */
export const diagnosisConcepts = {
  encounterTypes: {
    consultation: 'c2503561-c00d-5460-8157-43d594472b4a',
    patientInformation: 'ffdc883f-f99f-496a-83f9-2c3c581e1af0',
  },
  group: '594b4495-36dc-52a6-9810-15a9e2e2dcb9',
  category: '1a5aa050-661d-5e89-95d7-c1eba476df22',
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

/** The patient's consultations and Patient Information together, newest first. */
function useDiagnosisEncounters(patientUuid: string | null) {
  const consultations = useChartEncounters(patientUuid, diagnosisConcepts.encounterTypes.consultation);
  const information = useChartEncounters(patientUuid, diagnosisConcepts.encounterTypes.patientInformation);
  const tag = (list: Array<ChartEncounter>, onConsultation: boolean) =>
    list.map((encounter) => ({ ...encounter, onConsultation }));
  const encounters = [...tag(consultations.encounters, true), ...tag(information.encounters, false)].sort(
    (a, b) => parseDate(b.encounterDatetime).getTime() - parseDate(a.encounterDatetime).getTime(),
  );
  return {
    encounters,
    error: consultations.error ?? information.error,
    isLoading: consultations.isLoading || information.isLoading,
  };
}

/**
 * The diagnosis of the patient's latest consultation or Patient Information that records one, as the registry reads
 * it: the first Diagnosis with a Category, and its details in name order. Null with none.
 */
export function useLatestDiagnosis(patientUuid: string | null) {
  const { encounters, error, isLoading } = useDiagnosisEncounters(patientUuid);
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
  /** The consultation or Patient Information that records it, which Edit reopens. */
  encounterUuid: string;
  /** Whether a consultation records it; otherwise a Patient Information from before AR-167. */
  onConsultation: boolean;
  diagnosis: string;
  active: string;
  started: string | null;
  ended: string | null;
}

/** One Diagnosis answer group as a table row: the category with its details, and its status and dates. */
export function toDiagnosisRow(
  group: GroupedObs,
  key: string,
  encounterUuid: string,
  onConsultation = true,
): DiagnosisRow {
  const one = (concept: string) => answersIn(group.groupMembers, concept)[0]?.value;
  const category = answerText(one(diagnosisConcepts.category));
  const details = (group.groupMembers ?? [])
    .filter((member) => diagnosisConcepts.details.includes(member.concept.uuid))
    .map((member) => answerText(member.value))
    .sort();
  return {
    key,
    encounterUuid,
    onConsultation,
    diagnosis: details.length ? `${category} (${details.join(', ')})` : category,
    active: answerText(one(diagnosisConcepts.active)),
    started: one(diagnosisConcepts.started) ? String(one(diagnosisConcepts.started)) : null,
    ended: one(diagnosisConcepts.ended) ? String(one(diagnosisConcepts.ended)) : null,
  };
}

/**
 * Every Diagnosis with a Category in the patient's latest consultation or Patient Information that has one; earlier
 * records are superseded.
 */
export function useDiagnoses(patientUuid: string | null) {
  const { encounters, error, isLoading } = useDiagnosisEncounters(patientUuid);
  const withCategory = (encounter: ChartEncounter) =>
    answersIn(encounter.obs, diagnosisConcepts.group).filter(
      (group) => answersIn(group.groupMembers, diagnosisConcepts.category).length,
    );
  const latest = encounters.find((encounter) => withCategory(encounter).length);
  const diagnoses = latest
    ? withCategory(latest).map((group, index) =>
        toDiagnosisRow(group, `${latest.uuid}-${index}`, latest.uuid, latest.onConsultation),
      )
    : [];
  return { diagnoses, error, isLoading };
}
