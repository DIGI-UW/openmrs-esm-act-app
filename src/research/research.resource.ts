import useSWR from 'swr';
import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { type Study, useStudies } from '../studies/studies.resource';

interface RestEnrollment {
  uuid: string;
  program: { uuid: string };
  dateEnrolled: string;
  dateCompleted: string | null;
  attributes: Array<{ uuid: string; value: string; voided: boolean; attributeType: { uuid: string } }>;
  states: Array<{
    uuid: string;
    startDate: string;
    endDate: string | null;
    voided: boolean;
    state: { uuid: string };
  }>;
}

export interface StudyEnrollment {
  uuid: string;
  study: Study;
  studyId: string | null;
  /** The Study Participant ID attribute, to update in place. */
  studyIdAttributeUuid: string | null;
  dateEnrolled: string;
  dateCompleted: string | null;
  /** The current Study status: the one still open, else the one that started last. */
  stateUuid: string | null;
}

const enrollmentRep =
  'custom:(uuid,program:(uuid),dateEnrolled,dateCompleted,attributes:(uuid,value,voided,attributeType:(uuid)),states:(uuid,startDate,endDate,voided,state:(uuid)))';

function currentState(states: RestEnrollment['states']) {
  return (
    states
      .filter((state) => !state.voided)
      .sort(
        (a, b) =>
          Number(a.endDate !== null) - Number(b.endDate !== null) ||
          new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
      )[0]?.state.uuid ?? null
  );
}

/** The patient's enrolments in research studies, newest first; enrolments in other programs are left out. */
export function useStudyEnrollments(patientUuid: string) {
  const { studyParticipantIdAttributeType } = useConfig<Config>().studies;
  const { studies, error: studiesError, isLoading: studiesLoading } = useStudies();
  const url = `${restBaseUrl}/programenrollment?patient=${patientUuid}&v=${enrollmentRep}`;
  const { data, error, isLoading, mutate } = useSWR<Array<RestEnrollment>, Error>(
    patientUuid ? url : null,
    async () => (await openmrsFetch<{ results: Array<RestEnrollment> }>(url)).data.results,
  );
  const byUuid = new Map(studies.map((study) => [study.uuid, study]));
  const enrollments: Array<StudyEnrollment> = (data ?? [])
    .filter((enrollment) => byUuid.has(enrollment.program.uuid))
    .map((enrollment) => {
      const studyId = enrollment.attributes.find(
        (attribute) => !attribute.voided && attribute.attributeType.uuid === studyParticipantIdAttributeType,
      );
      return {
        uuid: enrollment.uuid,
        study: byUuid.get(enrollment.program.uuid),
        studyId: studyId?.value ?? null,
        studyIdAttributeUuid: studyId?.uuid ?? null,
        dateEnrolled: enrollment.dateEnrolled,
        dateCompleted: enrollment.dateCompleted,
        stateUuid: currentState(enrollment.states),
      };
    })
    .sort((a, b) => new Date(b.dateEnrolled).getTime() - new Date(a.dateEnrolled).getTime());
  return {
    enrollments,
    studies,
    error: error ?? studiesError,
    isLoading: isLoading || studiesLoading,
    mutate,
  };
}

export interface EnrollmentInput {
  studyUuid: string;
  studyId: string;
  /** yyyy-MM-dd */
  dateEnrolled: string;
  stateUuid: string;
  /** yyyy-MM-dd; the date an Inactive status took effect, which completes the enrolment. */
  dateCompleted: string | null;
}

const json = { 'Content-Type': 'application/json' };

/**
 * Enrols the patient in a study, or saves the changes to their enrolment. A new status starts on the enrolment
 * date, or for an Inactive one on the completion date, which core then records as the enrolment's end.
 */
export async function saveEnrollment(
  patientUuid: string,
  input: EnrollmentInput,
  studyParticipantIdAttributeType: string,
  existing?: StudyEnrollment,
) {
  const stateStart = input.dateCompleted ?? input.dateEnrolled;
  if (!existing) {
    await openmrsFetch(`${restBaseUrl}/programenrollment`, {
      method: 'POST',
      headers: json,
      body: {
        patient: patientUuid,
        program: input.studyUuid,
        dateEnrolled: input.dateEnrolled,
        ...(input.dateCompleted ? { dateCompleted: input.dateCompleted } : {}),
        states: [{ state: input.stateUuid, startDate: stateStart }],
        attributes: [{ attributeType: studyParticipantIdAttributeType, value: input.studyId }],
      },
    });
    return;
  }
  const statusChanged = input.stateUuid !== existing.stateUuid;
  await openmrsFetch(`${restBaseUrl}/programenrollment/${existing.uuid}`, {
    method: 'POST',
    headers: json,
    body: {
      dateEnrolled: input.dateEnrolled,
      dateCompleted: input.dateCompleted,
      ...(statusChanged ? { states: [{ state: input.stateUuid, startDate: stateStart }] } : {}),
    },
  });
  if (input.studyId !== existing.studyId) {
    await openmrsFetch(
      existing.studyIdAttributeUuid
        ? `${restBaseUrl}/programenrollment/${existing.uuid}/attribute/${existing.studyIdAttributeUuid}`
        : `${restBaseUrl}/programenrollment/${existing.uuid}/attribute`,
      {
        method: 'POST',
        headers: json,
        body: existing.studyIdAttributeUuid
          ? { value: input.studyId }
          : { attributeType: studyParticipantIdAttributeType, value: input.studyId },
      },
    );
  }
}

interface RestPerson {
  attributes: Array<{
    uuid: string;
    voided?: boolean;
    value: { uuid: string } | string;
    attributeType: { uuid: string };
  }>;
}

/** Whether the patient would like to be considered for research: the Yes or No concept, else null. */
export function useResearchOptIn(patientUuid: string) {
  const { researchOptInAttributeType } = useConfig<Config>().studies;
  const url = `${restBaseUrl}/person/${patientUuid}?v=custom:(attributes:(uuid,voided,value,attributeType:(uuid)))`;
  const { data, error, isLoading, mutate } = useSWR<RestPerson, Error>(
    patientUuid ? url : null,
    async () => (await openmrsFetch<RestPerson>(url)).data,
  );
  const attribute = data?.attributes.find((a) => !a.voided && a.attributeType.uuid === researchOptInAttributeType);
  const value = attribute ? (typeof attribute.value === 'string' ? attribute.value : attribute.value?.uuid) : null;
  return { optIn: value ?? null, error, isLoading, mutate };
}

/**
 * Saves the answer through the patient, which needs Edit Patients as registration does, rather than Edit People;
 * the patient keeps one answer, as saving a person attribute replaces the one of its type.
 */
export async function saveResearchOptIn(patientUuid: string, conceptUuid: string, researchOptInAttributeType: string) {
  await openmrsFetch(`${restBaseUrl}/patient/${patientUuid}`, {
    method: 'POST',
    headers: json,
    body: { person: { attributes: [{ attributeType: researchOptInAttributeType, value: conceptUuid }] } },
  });
}
