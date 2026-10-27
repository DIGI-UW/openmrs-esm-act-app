import dayjs from 'dayjs';
import { parseDate } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { answersIn, type ChartEncounter, type GroupedObs } from '../consultations/consultations.resource';
import { diagnosisConcepts } from '../consultations/patient-details.resource';

const YES = '1065AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

const uuidOf = (value: unknown) =>
  typeof value === 'object' && value !== null ? String((value as { uuid?: string }).uuid ?? '') : String(value ?? '');

/** Completed answered Yes, CIEL's or core's True, as the Procedural Waiting List reads it. */
const isCompleted = (group: GroupedObs, completed: string) =>
  answersIn(group.groupMembers, completed).some((answer) => {
    const value = answer.value;
    return (
      value === true ||
      uuidOf(value) === YES ||
      (typeof value === 'object' && value !== null && (value as { display?: string }).display === 'True')
    );
  });

/** The calendar day of an OpenMRS timestamp as the server wrote it, as the reports' DATE() reads it. */
const serverDay = (timestamp: string) => timestamp.slice(0, 10);

/** A procedure recorded on Procedures and Outcomes: what was done, by answer uuid, and on which day. */
export interface DoneProcedure {
  procedure: string;
  day: string;
}

/**
 * The procedures each Procedures and Outcomes encounter records, dated by its Date of Procedure, else the encounter's
 * date. Surgery and Catheterization Type are each a group whose member, of the same concept, holds the answer.
 */
export function doneProcedures(
  encounters: Array<ChartEncounter>,
  concepts: Config['procedures']['concepts'],
): Array<DoneProcedure> {
  const types = [concepts.surgeryType, concepts.catheterizationType];
  return encounters.flatMap((encounter) => {
    const dated = answersIn(encounter.obs, concepts.date)[0]?.value;
    const day = serverDay(typeof dated === 'string' ? dated : encounter.encounterDatetime);
    return (encounter.obs ?? [])
      .flatMap((one) => [one, ...(one.groupMembers ?? [])])
      .filter((one) => types.includes(one.concept.uuid) && one.value != null && typeof one.value === 'object')
      .map((one) => ({ procedure: uuidOf(one.value), day }));
  });
}

/**
 * The procedures a consultation recommends and has not completed, by answer uuid: completed when answered Completed,
 * or when the procedure is recorded on Procedures and Outcomes on or after the consultation's day (AR-162).
 */
function openProcedures(
  encounter: ChartEncounter,
  concepts: Config['consultations']['concepts'],
  done: Array<DoneProcedure>,
) {
  const day = serverDay(encounter.encounterDatetime);
  return answersIn(encounter.obs, concepts.recommendation)
    .filter((group) => !isCompleted(group, concepts.completed))
    .map((group) => uuidOf(answersIn(group.groupMembers, concepts.recommendation)[0]?.value))
    .filter(Boolean)
    .filter((procedure) => !done.some((one) => one.procedure === procedure && one.day >= day));
}

export type ProcedureStatus = 'recent' | 'old' | 'none';

/**
 * The prototype's procedural recommendation flag, from the consultations newest first: none when the latest records
 * no open recommendation; otherwise recent or old by when it was first recommended, the oldest consultation in the
 * unbroken run back from the latest that still recommends one of its procedures, under or over 12 months ago. Null
 * for a patient with no consultation.
 */
export function procedureStatus(
  consultations: Array<ChartEncounter>,
  concepts: Config['consultations']['concepts'],
  now = new Date(),
  done: Array<DoneProcedure> = [],
): ProcedureStatus | null {
  if (!consultations.length) {
    return null;
  }
  const open = new Set(openProcedures(consultations[0], concepts, done));
  if (!open.size) {
    return 'none';
  }
  let first = consultations[0];
  for (const encounter of consultations.slice(1)) {
    if (!openProcedures(encounter, concepts, done).some((procedure) => open.has(procedure))) {
      break;
    }
    first = encounter;
  }
  return dayjs(now).diff(dayjs(parseDate(first.encounterDatetime)), 'month', true) < 12 ? 'recent' : 'old';
}

/**
 * Whether the patient needs a confirmatory echo, as Screen positive, pending confirmation reads it: the latest Screen +
 * answer on their Patient Information is Yes, and no Patient Information records a diagnosis category.
 */
export function needsConfirmatoryEcho(patientInformation: Array<ChartEncounter>, screenPositive: string) {
  const latestScreen = patientInformation.flatMap((encounter) => answersIn(encounter.obs, screenPositive))[0];
  if (!latestScreen || uuidOf(latestScreen.value) !== YES) {
    return false;
  }
  const diagnosed = patientInformation.some((encounter) =>
    answersIn(encounter.obs, diagnosisConcepts.group).some(
      (group) => answersIn(group.groupMembers, diagnosisConcepts.category).length,
    ),
  );
  return !diagnosed;
}
