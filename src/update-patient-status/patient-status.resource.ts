import dayjs from 'dayjs';
import useSWR from 'swr';
import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { fetchAll } from '../fetch-all';

export interface Enrolment {
  uuid: string;
  dateEnrolled: string;
  dateCompleted: string | null;
  voided?: boolean;
  program: { uuid: string };
  states: Array<{
    uuid?: string;
    startDate: string;
    endDate: string | null;
    voided?: boolean;
    state: { uuid: string; concept: { uuid: string; display: string } };
  }>;
}

interface Program {
  allWorkflows: Array<{
    retired?: boolean;
    states: Array<{
      uuid: string;
      terminal: boolean;
      retired?: boolean;
      concept: { uuid: string; display: string };
    }>;
  }>;
}

interface Person {
  dead: boolean;
  deathDate: string | null;
  birthdate: string | null;
  gender: string | null;
}

export interface StatusOption {
  uuid: string;
  name: string;
  concept: string;
  death: boolean;
  /** Active again: a new enrolment for a patient who returned, rather than a state of the ended one. */
  reenrol?: boolean;
}

/** An answer recorded with the status, under the question's concept: a coded answer's uuid, or text. */
export interface StatusAnswer {
  concept: string;
  value: string;
}

const enrolmentRepresentation =
  'custom:(uuid,dateEnrolled,dateCompleted,voided,program:(uuid),states:(uuid,startDate,endDate,voided,state:(uuid,concept:(uuid,display))))';
const programRepresentation = 'custom:(allWorkflows:(retired,states:(uuid,terminal,retired,concept:(uuid,display))))';

/** The patient's latest enrolment in the registry programme that is not voided. */
export function registryEnrolmentOf(enrolments: Array<Enrolment>, programUuid: string) {
  return (
    enrolments
      .filter((one) => !one.voided && one.program.uuid === programUuid)
      .sort((a, b) => b.dateEnrolled.localeCompare(a.dateEnrolled))[0] ?? null
  );
}

/**
 * The status a completed enrolment ended in: its latest state by start, the later in the array on a tie as core
 * truncates starts to midnight. Null for an active enrolment; a null name and uuid when no state was recorded.
 */
export function statusOf(enrolment: Enrolment) {
  if (!enrolment.dateCompleted) {
    return null;
  }
  const latest = enrolment.states
    .map((one, index) => ({ ...one, index }))
    .filter((one) => !one.voided)
    .sort((a, b) => b.startDate.localeCompare(a.startDate) || b.index - a.index)[0];
  return {
    uuid: latest?.state.uuid ?? null,
    patientState: latest?.uuid ?? null,
    name: latest?.state.concept.display ?? null,
    since: latest?.startDate ?? enrolment.dateCompleted,
  };
}

/** The workflow's terminal states that are not retired, in the order the workflow has them. */
export function terminalStatesOf(program: Program, deathConcept: string): Array<StatusOption> {
  return program.allWorkflows
    .filter((workflow) => !workflow.retired)
    .flatMap((workflow) => workflow.states)
    .filter((one) => one.terminal && !one.retired)
    .map((one) => ({
      uuid: one.uuid,
      name: one.concept.display,
      concept: one.concept.uuid,
      death: one.concept.uuid === deathConcept,
    }));
}

/**
 * The statuses this user may record: ending an enrolment needs Edit Patient Programs, and a death Edit People too, so
 * only those who record patient status record a death. A dead patient's enrolment can only end as Deceased. A living
 * patient whose enrolment ended may have it corrected to another status, or be enrolled again as Active.
 */
export function statusOptionsOf({
  states,
  enrolmentActive,
  enrolmentEnded = false,
  personDead,
  mayEditPrograms,
  mayEditPeople,
}: {
  states: Array<StatusOption>;
  enrolmentActive: boolean;
  enrolmentEnded?: boolean;
  personDead: boolean;
  mayEditPrograms: boolean;
  mayEditPeople: boolean;
}) {
  const mayMarkDead = mayEditPeople && mayEditPrograms;
  return states.filter((one) => {
    if (!enrolmentActive && enrolmentEnded && !personDead) {
      return one.death ? mayMarkDead : mayEditPrograms;
    }
    if (!enrolmentActive) {
      return one.death && !personDead && mayMarkDead;
    }
    if (one.reenrol) {
      return false;
    }
    if (personDead) {
      return one.death && mayEditPrograms;
    }
    return one.death ? mayMarkDead : mayEditPrograms;
  });
}

/** The patient's registry enrolment, the states its workflow offers, and whether the person is dead. */
export function usePatientStatus(patientUuid: string | null, programUuid: string) {
  const enrolments = useSWR<Array<Enrolment>, Error>(
    patientUuid ? `${restBaseUrl}/programenrollment?patient=${patientUuid}&v=${enrolmentRepresentation}` : null,
    (url: string) => openmrsFetch<{ results: Array<Enrolment> }>(url).then((response) => response.data.results),
  );
  const program = useSWR<Program, Error>(
    `${restBaseUrl}/program/${programUuid}?v=${programRepresentation}`,
    (url: string) => openmrsFetch<Program>(url).then((response) => response.data),
  );
  const person = useSWR<Person, Error>(
    patientUuid ? `${restBaseUrl}/person/${patientUuid}?v=custom:(dead,deathDate,birthdate,gender)` : null,
    (url: string) => openmrsFetch<Person>(url).then((response) => response.data),
  );
  return {
    enrolment: enrolments.data ? registryEnrolmentOf(enrolments.data, programUuid) : null,
    program: program.data,
    person: person.data,
    isLoading: enrolments.isLoading || program.isLoading || person.isLoading,
    error: enrolments.error ?? program.error ?? person.error,
  };
}

/** A date as the server takes it: today as the present moment, so that a clock ahead of the server's is not the future. */
const serverDate = (date: string) => (dayjs(date).isSame(dayjs(), 'day') ? new Date().toISOString() : date);

/** Marks the person dead on the date with a coded cause, which core requires of a dead person. */
export async function markDead(personUuid: string, deathDate: string, causeConcept: string) {
  await openmrsFetch(`${restBaseUrl}/person/${personUuid}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { dead: true, deathDate: serverDate(deathDate), causeOfDeath: causeConcept },
  });
}

/** The patient's latest encounter of the type, which keeps the status answers, or null when there is none. */
export async function latestEncounterOf(patientUuid: string, encounterType: string) {
  const encounters = await fetchAll<{ uuid: string; encounterDatetime: string }>(
    `${restBaseUrl}/encounter?patient=${patientUuid}&encounterType=${encounterType}&v=custom:(uuid,encounterDatetime)`,
  );
  return [...encounters].sort((a, b) => b.encounterDatetime.localeCompare(a.encounterDatetime))[0] ?? null;
}

/**
 * Saves the answers recorded with a status, each dated with the status change, on the patient's latest encounter of
 * the type, as ACT 2.0 kept them on Patient Information; a patient with no encounter of the type gets one under the
 * form, so the chart opens it as that form.
 */
export async function saveStatusAnswers({
  patient,
  encounterType,
  form,
  location,
  date,
  answers,
}: {
  patient: string;
  encounterType: string;
  form: string;
  location: string | null;
  date: string;
  answers: Array<StatusAnswer>;
}) {
  const obsDatetime = serverDate(date);
  const obs = answers.map((one) => ({ concept: one.concept, person: patient, value: one.value, obsDatetime }));
  const headers = { 'Content-Type': 'application/json' };
  const latest = await latestEncounterOf(patient, encounterType);
  if (latest) {
    await openmrsFetch(`${restBaseUrl}/encounter/${latest.uuid}`, { method: 'POST', headers, body: { obs } });
    return;
  }
  await openmrsFetch(`${restBaseUrl}/encounter`, {
    method: 'POST',
    headers,
    body: { patient, encounterType, form, encounterDatetime: obsDatetime, obs, ...(location ? { location } : {}) },
  });
}

/** The instant an enrolment ends on the date: not before it was enrolled, which carries a time of day. */
const endOf = (date: string, dateEnrolled: string) => {
  // A bare day reads as midnight, which core rejects as before an enrolment that carries a time of day.
  const sent = serverDate(date);
  return new Date(sent).getTime() < new Date(dateEnrolled).getTime() ? dateEnrolled : sent;
};

/** Ends the enrolment on the date in the given terminal state, which the registry, worklists and Dashboard read. */
export async function endEnrolment(enrolmentUuid: string, stateUuid: string, date: string, dateEnrolled: string) {
  const end = endOf(date, dateEnrolled);
  await openmrsFetch(`${restBaseUrl}/programenrollment/${enrolmentUuid}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { dateCompleted: end, states: [{ state: stateUuid, startDate: end }] },
  });
}

/**
 * Corrects an ended enrolment to another terminal state on the date: the state it ended in is voided, the end moved,
 * and the new state recorded, in that order, as core refuses a state that starts after the end it still has.
 */
export async function correctEnrolment({
  enrolmentUuid,
  endedStateUuid,
  stateUuid,
  date,
  dateEnrolled,
}: {
  enrolmentUuid: string;
  endedStateUuid: string | null;
  stateUuid: string;
  date: string;
  dateEnrolled: string;
}) {
  const headers = { 'Content-Type': 'application/json' };
  const end = endOf(date, dateEnrolled);
  if (endedStateUuid) {
    await openmrsFetch(`${restBaseUrl}/programenrollment/${enrolmentUuid}/state/${endedStateUuid}`, {
      method: 'DELETE',
    });
  }
  await openmrsFetch(`${restBaseUrl}/programenrollment/${enrolmentUuid}`, {
    method: 'POST',
    headers,
    body: { dateCompleted: end },
  });
  await openmrsFetch(`${restBaseUrl}/programenrollment/${enrolmentUuid}`, {
    method: 'POST',
    headers,
    body: { states: [{ state: stateUuid, startDate: end }] },
  });
}

/** Enrols a returning patient again from the date, at the login location, as ACT Core enrols on registration. */
export async function reenrol(patientUuid: string, programUuid: string, date: string, location: string | null) {
  await openmrsFetch(`${restBaseUrl}/programenrollment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      patient: patientUuid,
      program: programUuid,
      dateEnrolled: serverDate(date),
      ...(location ? { location } : {}),
    },
  });
}
