import useSWR from 'swr';
import dayjs from 'dayjs';
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
    auditInfo: { dateCreated: string };
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
  /**
   * The current Study status: the one still open, else the one that started last; on a tie an Inactive one, then the
   * one recorded last.
   */
  stateUuid: string | null;
  /** The patient state recording the current status, to change an Inactive reason in place. */
  patientStateUuid: string | null;
  /** Whether the current status is open and began on the enrolment date, so its start moves with that date. */
  stateStartsOnEnrollment: boolean;
}

const enrollmentRep =
  'custom:(uuid,program:(uuid),dateEnrolled,dateCompleted,attributes:(uuid,value,voided,attributeType:(uuid)),states:(uuid,startDate,endDate,voided,state:(uuid),auditInfo:(dateCreated)))';

function currentState(states: RestEnrollment['states'], study: Study) {
  const terminal = (state: RestEnrollment['states'][number]) =>
    Number(study.states.some((s) => s.uuid === state.state.uuid && s.terminal));
  return (
    states
      .filter((state) => !state.voided)
      .sort(
        (a, b) =>
          Number(a.endDate !== null) - Number(b.endDate !== null) ||
          new Date(b.startDate).getTime() - new Date(a.startDate).getTime() ||
          // A same-day enrolment and withdrawal shows the withdrawal, not Active.
          terminal(b) - terminal(a) ||
          // Two same-day Inactive reasons show the one recorded last, as the participants report does.
          new Date(b.auditInfo.dateCreated).getTime() - new Date(a.auditInfo.dateCreated).getTime() ||
          // REST lists states in no fixed order, so the chart would flip between ones recorded in the same second.
          a.uuid.localeCompare(b.uuid),
      )[0] ?? null
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
      const study = byUuid.get(enrollment.program.uuid);
      const state = currentState(enrollment.states, study);
      const studyId = enrollment.attributes.find(
        (attribute) => !attribute.voided && attribute.attributeType.uuid === studyParticipantIdAttributeType,
      );
      return {
        uuid: enrollment.uuid,
        study,
        studyId: studyId?.value ?? null,
        studyIdAttributeUuid: studyId?.uuid ?? null,
        dateEnrolled: enrollment.dateEnrolled,
        dateCompleted: enrollment.dateCompleted,
        stateUuid: state?.state.uuid ?? null,
        patientStateUuid: state?.uuid ?? null,
        stateStartsOnEnrollment:
          !!state && state.endDate === null && dayjs(state.startDate).isSame(enrollment.dateEnrolled, 'day'),
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
  /** yyyy-MM-dd; the end of the enrolment, on which a new Inactive status starts. */
  dateCompleted: string | null;
}

const json = { 'Content-Type': 'application/json' };

/**
 * Enrols the patient in a study, or saves the changes to their enrolment. A new status starts on the enrolment
 * date, or for an Inactive one on the completion date, which core then records as the enrolment's end. The open
 * status that began on the enrolment date starts on a changed enrolment date too, but a changed completion date
 * leaves the closed statuses' dates as they were: the chart and report read the completion date from the enrolment.
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
  // Core adds a new status beside a closed Inactive one rather than ending it, which leaves two reasons.
  const reasonChanged =
    statusChanged &&
    !!existing.dateCompleted &&
    !!existing.patientStateUuid &&
    existing.study.states.some((s) => s.uuid === existing.stateUuid && s.terminal);
  // Moved first, as core refuses to end a status on a date before it started.
  if (existing.stateStartsOnEnrollment && input.dateEnrolled !== dayjs(existing.dateEnrolled).format('YYYY-MM-DD')) {
    await openmrsFetch(`${restBaseUrl}/programenrollment/${existing.uuid}/state/${existing.patientStateUuid}`, {
      method: 'POST',
      headers: json,
      body: { startDate: input.dateEnrolled },
    });
  }
  await openmrsFetch(`${restBaseUrl}/programenrollment/${existing.uuid}`, {
    method: 'POST',
    headers: json,
    body: {
      dateEnrolled: input.dateEnrolled,
      dateCompleted: input.dateCompleted,
      ...(statusChanged && !reasonChanged ? { states: [{ state: input.stateUuid, startDate: stateStart }] } : {}),
    },
  });
  if (reasonChanged) {
    await openmrsFetch(`${restBaseUrl}/programenrollment/${existing.uuid}/state/${existing.patientStateUuid}`, {
      method: 'POST',
      headers: json,
      body: { state: input.stateUuid },
    });
  }
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
  dead: boolean;
  attributes: Array<{
    uuid: string;
    voided?: boolean;
    value: { uuid: string } | string;
    attributeType: { uuid: string };
  }>;
}

/**
 * What gates enrolling the patient in a study: whether they would like to be considered for research and whether they
 * gave registry consent at registration, each as its concept or null, and whether they have died.
 */
export function useResearchAnswers(patientUuid: string) {
  const { researchOptInAttributeType, consentAttributeType } = useConfig<Config>().studies;
  const url = `${restBaseUrl}/person/${patientUuid}?v=custom:(dead,attributes:(uuid,voided,value,attributeType:(uuid)))`;
  const { data, error, isLoading, mutate } = useSWR<RestPerson, Error>(
    patientUuid ? url : null,
    async () => (await openmrsFetch<RestPerson>(url)).data,
  );
  const answer = (attributeType: string) => {
    const attribute = data?.attributes.find((a) => !a.voided && a.attributeType.uuid === attributeType);
    return (attribute && (typeof attribute.value === 'string' ? attribute.value : attribute.value?.uuid)) || null;
  };
  return {
    optIn: answer(researchOptInAttributeType),
    consent: answer(consentAttributeType),
    dead: data?.dead ?? false,
    error,
    isLoading,
    mutate,
  };
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
