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

/** The procedures a consultation recommends and has not completed, by answer uuid. */
function openProcedures(encounter: ChartEncounter, concepts: Config['consultations']['concepts']) {
  return answersIn(encounter.obs, concepts.recommendation)
    .filter((group) => !isCompleted(group, concepts.completed))
    .map((group) => uuidOf(answersIn(group.groupMembers, concepts.recommendation)[0]?.value))
    .filter(Boolean);
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
): ProcedureStatus | null {
  if (!consultations.length) {
    return null;
  }
  const open = new Set(openProcedures(consultations[0], concepts));
  if (!open.size) {
    return 'none';
  }
  let first = consultations[0];
  for (const encounter of consultations.slice(1)) {
    if (!openProcedures(encounter, concepts).some((procedure) => open.has(procedure))) {
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
