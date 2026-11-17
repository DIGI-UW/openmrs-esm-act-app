import { openmrsFetch, parseDate, restBaseUrl } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import {
  answerText,
  answersIn,
  answerUuid,
  type ChartEncounter,
  type GroupedObs,
} from '../consultations/consultations.resource';

type Concepts = Config['inrReviews']['concepts'];

// The day the server recorded, whatever the browser zone: a midnight at the server's offset.
const day = (value: unknown) => {
  const text = String(value ?? '');
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : '';
};

export interface InrEntry {
  encounterUuid: string;
  /** How many INR entries the encounter holds: they share its one INR Target and Next INR Date. */
  groupCount: number;
  group: { uuid: string; memberUuids: Array<string> } | null;
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

export function latestInrEntry(
  encounters: Array<ChartEncounter>,
  concepts: Concepts,
  onlyGroup?: string | null,
): InrEntry | null {
  let best: { encounter: ChartEncounter; group: GroupedObs; time: number } | null = null;
  for (const encounter of encounters) {
    for (const group of answersIn(encounter.obs, concepts.group)) {
      if (onlyGroup ? group.uuid !== onlyGroup : !answersIn(group.groupMembers, concepts.value).length) {
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
    group: best
      ? { uuid: best.group.uuid ?? '', memberUuids: (members ?? []).map((member) => member.uuid ?? '') }
      : null,
    dateTested: best ? day(tested?.value ?? encounter.encounterDatetime) : '',
    inr: inr ? Number(inr.value) : null,
    doseChange: dose ? answerUuid(dose.value) : '',
    newDose: newDose ? answerText(newDose.value) : '',
    target: target ? { obsUuid: target.uuid ?? '', valueUuid: answerUuid(target.value) } : null,
    next: next ? { obsUuid: next.uuid ?? '', value: day(next.value) } : null,
  };
}

export function inrPayload(patient: string, concepts: Concepts, entry: InrEntry, edit: InrEdit): Array<ObsChange> {
  const answer = (concept: string, value: unknown): NewObs => ({ concept, person: patient, value });
  const ownsEncounterAnswers = entry.groupCount <= 1;
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
  if (entry.group) {
    // Voiding a group row leaves its members live, so they are voided with it.
    for (const uuid of [entry.group.uuid, ...entry.group.memberUuids]) {
      voided.push({ uuid, voided: true });
    }
  }
  if (ownsEncounterAnswers) {
    if (edit.target && edit.target !== entry.target?.valueUuid) {
      if (entry.target) {
        voided.push({ uuid: entry.target.obsUuid, voided: true });
      }
      added.push(answer(concepts.target, edit.target));
    }
    if (edit.nextInr !== (entry.next?.value ?? '')) {
      if (entry.next) {
        voided.push({ uuid: entry.next.obsUuid, voided: true });
      }
      if (edit.nextInr) {
        added.push(answer(concepts.nextInr, edit.nextInr));
      }
    }
  }
  return [...voided, ...added];
}

/** Saves the edit to the entry's encounter in place, naming no visit, location or date. */
export async function saveInr({
  patient,
  concepts,
  entry,
  edit,
}: {
  patient: string;
  concepts: Concepts;
  entry: InrEntry;
  edit: InrEdit;
}) {
  const obs = inrPayload(patient, concepts, entry, edit);
  await openmrsFetch(`${restBaseUrl}/encounter/${entry.encounterUuid}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { obs },
  });
}
