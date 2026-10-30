import { openmrsFetch, parseDate, restBaseUrl } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { answerText, answersIn, type ChartEncounter, type GroupedObs } from '../consultations/consultations.resource';

type Concepts = Config['inrReviews']['concepts'];

// The day the server recorded, in any browser zone: its value is a midnight at the server's offset.
const day = (value: unknown) => {
  const text = String(value ?? '');
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : '';
};
const answerUuid = (value: unknown) =>
  typeof value === 'object' && value !== null ? String((value as { uuid?: string }).uuid ?? '') : '';

/** The INR entry the editor changes, with the uuids of the answers it replaces. */
export interface InrEntry {
  encounterUuid: string;
  /** How many INR entries the encounter holds: they share its one INR Target and Next INR Date. */
  groupCount: number;
  /** Null for an INR Monitoring that holds no INR yet. */
  group: { uuid: string } | null;
  dateTested: string;
  inr: number | null;
  doseChange: string;
  newDose: string;
  target: { obsUuid: string; valueUuid: string } | null;
  next: { obsUuid: string; value: string } | null;
}

export interface InrEdit {
  dateTested: string;
  inr: number;
  doseChange: string;
  newDose: string;
  target: string;
  nextInr: string;
}

interface NewObs {
  concept: string;
  person: string;
  value?: unknown;
  groupMembers?: Array<NewObs>;
}
type ObsChange = NewObs | { uuid: string; voided: true };

/**
 * The INR entry with the newest Date Tested (else its encounter's date) among those that hold an INR, in its own
 * encounter. With none, the newest INR Monitoring encounter, which an entry can be added to; with no encounter, null.
 */
export function latestInrEntry(encounters: Array<ChartEncounter>, concepts: Concepts): InrEntry | null {
  let best: { encounter: ChartEncounter; group: GroupedObs; time: number } | null = null;
  for (const encounter of encounters) {
    for (const group of answersIn(encounter.obs, concepts.group)) {
      if (!answersIn(group.groupMembers, concepts.value).length) {
        continue;
      }
      const [tested] = answersIn(group.groupMembers, concepts.dateTested);
      const time = parseDate(String(tested?.value ?? encounter.encounterDatetime)).getTime();
      if (!best || time > best.time) {
        best = { encounter, group, time };
      }
    }
  }
  const encounter =
    best?.encounter ??
    [...encounters].sort(
      (a, b) => parseDate(b.encounterDatetime).getTime() - parseDate(a.encounterDatetime).getTime(),
    )[0];
  if (!encounter) {
    return null;
  }
  const [target] = answersIn(encounter.obs, concepts.target);
  const [next] = answersIn(encounter.obs, concepts.nextInr);
  const members = best?.group.groupMembers;
  const [tested] = answersIn(members, concepts.dateTested);
  const [inr] = answersIn(members, concepts.value);
  const [dose] = answersIn(members, concepts.doseChange);
  const [newDose] = answersIn(members, concepts.newDose);
  return {
    encounterUuid: encounter.uuid,
    groupCount: answersIn(encounter.obs, concepts.group).length,
    group: best ? { uuid: best.group.uuid ?? '' } : null,
    dateTested: best ? day(tested?.value ?? encounter.encounterDatetime) : '',
    inr: inr ? Number(inr.value) : null,
    doseChange: dose ? answerUuid(dose.value) : '',
    newDose: newDose ? answerText(newDose.value) : '',
    target: target ? { obsUuid: target.uuid ?? '', valueUuid: answerUuid(target.value) } : null,
    next: next ? { obsUuid: next.uuid ?? '', value: day(next.value) } : null,
  };
}

/**
 * The answers one request saves: the entry's group voided and written again whole, as the engine saves only the changed
 * member. The target and next INR, shared by an encounter's entries, change only for a sole entry and only if they differ.
 */
export function inrPayload(
  patient: string,
  concepts: Concepts,
  entry: InrEntry | null,
  edit: InrEdit,
): Array<ObsChange> {
  const answer = (concept: string, value: unknown): NewObs => ({ concept, person: patient, value });
  const ownsEncounterAnswers = !entry || entry.groupCount <= 1;
  const voided: Array<ObsChange> = [];
  const added: Array<ObsChange> = [
    {
      concept: concepts.group,
      person: patient,
      groupMembers: [
        answer(concepts.dateTested, edit.dateTested),
        answer(concepts.value, edit.inr),
        ...(edit.doseChange ? [answer(concepts.doseChange, edit.doseChange)] : []),
        ...(edit.newDose ? [answer(concepts.newDose, edit.newDose)] : []),
      ],
    },
  ];
  if (entry?.group) {
    voided.push({ uuid: entry.group.uuid, voided: true });
  }
  if (ownsEncounterAnswers) {
    if (edit.target && edit.target !== entry?.target?.valueUuid) {
      if (entry?.target) {
        voided.push({ uuid: entry.target.obsUuid, voided: true });
      }
      added.push(answer(concepts.target, edit.target));
    }
    if (edit.nextInr !== (entry?.next?.value ?? '')) {
      if (entry?.next) {
        voided.push({ uuid: entry.next.obsUuid, voided: true });
      }
      if (edit.nextInr) {
        added.push(answer(concepts.nextInr, edit.nextInr));
      }
    }
  }
  return [...voided, ...added];
}

/**
 * Saves the edit to the server: the entry's encounter in place, naming no visit, location or date, or with no entry a
 * new encounter, which the server places in the patient's active visit.
 */
export async function saveInr({
  patient,
  encounterType,
  location,
  concepts,
  entry,
  edit,
}: {
  patient: string;
  encounterType: string;
  location: string;
  concepts: Concepts;
  entry: InrEntry | null;
  edit: InrEdit;
}) {
  const obs = inrPayload(patient, concepts, entry, edit);
  const headers = { 'Content-Type': 'application/json' };
  if (entry) {
    await openmrsFetch(`${restBaseUrl}/encounter/${entry.encounterUuid}`, { method: 'POST', headers, body: { obs } });
    return;
  }
  await openmrsFetch(`${restBaseUrl}/encounter`, {
    method: 'POST',
    headers,
    body: { patient, encounterType, location, obs },
  });
}
