import dayjs from 'dayjs';
import useSWR from 'swr';
import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

export interface Enrolment {
  uuid: string;
  dateEnrolled: string;
  dateCompleted: string | null;
  voided?: boolean;
  program: { uuid: string };
  states: Array<{
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

export interface StatusOption {
  uuid: string;
  name: string;
  death: boolean;
}

const enrolmentRepresentation =
  'custom:(uuid,dateEnrolled,dateCompleted,voided,program:(uuid),states:(startDate,endDate,voided,state:(uuid,concept:(uuid,display))))';
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
 * The status a completed enrolment ended in: its latest state by start, since core ends a state when it completes
 * the enrolment. Null for an active enrolment; a null name when no state was recorded.
 */
export function statusOf(enrolment: Enrolment) {
  if (!enrolment.dateCompleted) {
    return null;
  }
  const latest = enrolment.states
    .filter((one) => !one.voided)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
  return { name: latest?.state.concept.display ?? null, since: latest?.startDate ?? enrolment.dateCompleted };
}

/** The workflow's terminal states that are not retired, in the order the workflow has them. */
export function terminalStatesOf(program: Program, deathConcept: string): Array<StatusOption> {
  return program.allWorkflows
    .filter((workflow) => !workflow.retired)
    .flatMap((workflow) => workflow.states)
    .filter((one) => one.terminal && !one.retired)
    .map((one) => ({ uuid: one.uuid, name: one.concept.display, death: one.concept.uuid === deathConcept }));
}

/**
 * The statuses this user may record: ending an enrolment needs Edit Patient Programs, and marking the person dead
 * needs Edit People. A patient with no enrolment in force can only be marked dead.
 */
export function statusOptionsOf({
  states,
  enrolmentActive,
  personDead,
  mayEditPrograms,
  mayEditPeople,
}: {
  states: Array<StatusOption>;
  enrolmentActive: boolean;
  personDead: boolean;
  mayEditPrograms: boolean;
  mayEditPeople: boolean;
}) {
  return states.filter((one) => {
    if (!enrolmentActive) {
      return one.death && !personDead && mayEditPeople;
    }
    if (!one.death) {
      return mayEditPrograms;
    }
    return personDead ? mayEditPrograms : mayEditPeople;
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
  const person = useSWR<{ dead: boolean; deathDate: string | null }, Error>(
    patientUuid ? `${restBaseUrl}/person/${patientUuid}?v=custom:(dead,deathDate)` : null,
    (url: string) => openmrsFetch<{ dead: boolean; deathDate: string | null }>(url).then((response) => response.data),
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

/** Marks the person dead on the date, with a cause in words when given. */
export async function markDead(personUuid: string, deathDate: string, cause: string) {
  await openmrsFetch(`${restBaseUrl}/person/${personUuid}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { dead: true, deathDate: serverDate(deathDate), ...(cause ? { causeOfDeathNonCoded: cause } : {}) },
  });
}

/** Ends the enrolment on the date in the given terminal state, which the registry, worklists and Dashboard read. */
export async function endEnrolment(enrolmentUuid: string, stateUuid: string, date: string) {
  await openmrsFetch(`${restBaseUrl}/programenrollment/${enrolmentUuid}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { dateCompleted: serverDate(date), states: [{ state: stateUuid, startDate: serverDate(date) }] },
  });
}
