import { parseDate } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { answersIn, answerText, type ChartEncounter } from './consultations.resource';

type Concepts = Config['consultations']['concepts'];

const answerUuid = (value: unknown) =>
  typeof value === 'object' && value !== null ? String((value as { uuid?: string }).uuid ?? '') : '';

const time = (date: string) => parseDate(date).getTime();

export interface Medication {
  key: string;
  name: string;
  dose: string;
  interval: string;
  started: string;
  stopped: string | null;
}

/**
 * The patient's cardiac medications, one row per medicine, read oldest consultation first.
 * The latest record decides the state: a Date Stopped means Past, none means Active.
 */
export function toMedications(encounters: Array<ChartEncounter>, concepts: Concepts) {
  const rows = new Map<string, Medication & { recordedStart: string }>();
  const oldestFirst = [...encounters].sort((a, b) => time(a.encounterDatetime) - time(b.encounterDatetime));
  for (const encounter of oldestFirst) {
    for (const group of answersIn(encounter.obs, concepts.medication)) {
      const [medicine] = answersIn(group.groupMembers, concepts.medication);
      if (!medicine) {
        continue;
      }
      const text = (concept: string) => {
        const [one] = answersIn(group.groupMembers, concept);
        return one ? answerText(one.value) : '';
      };
      const uuid = answerUuid(medicine.value);
      const dateStarted = text(concepts.dateStarted);
      const row = rows.get(uuid) ?? {
        key: uuid,
        name: answerText(medicine.value),
        dose: '',
        interval: '',
        started: encounter.encounterDatetime,
        stopped: null,
        recordedStart: '',
      };
      row.dose = text(concepts.medicationDose) || row.dose;
      row.interval = text(concepts.medicationInterval) || row.interval;
      row.stopped = text(concepts.dateStopped) || null;
      if (dateStarted && (!row.recordedStart || time(dateStarted) < time(row.recordedStart))) {
        row.recordedStart = dateStarted;
        row.started = dateStarted;
      }
      rows.set(uuid, row);
    }
  }
  const all = [...rows.values()];
  return {
    active: all.filter((one) => !one.stopped).sort((a, b) => time(b.started) - time(a.started)),
    past: all.filter((one) => one.stopped).sort((a, b) => time(b.stopped!) - time(a.stopped!)),
  };
}

export interface ListedItem {
  key: string;
  name: string;
  added: string;
}

/**
 * One of the consultation's repeated lists, each item once, newest first.
 * An item's date is the earliest Date Added recorded, else the first consultation that recorded it.
 */
export function toListedItems(encounters: Array<ChartEncounter>, concepts: Concepts, list: string): Array<ListedItem> {
  const byKey = new Map<string, { name: string; recorded: string; consulted: string }>();
  for (const encounter of encounters) {
    for (const group of answersIn(encounter.obs, list)) {
      const [name] = answersIn(group.groupMembers, list);
      if (!name) {
        continue;
      }
      const key = answerUuid(name.value) || answerText(name.value);
      const [dateAdded] = answersIn(group.groupMembers, concepts.dateAdded);
      const added = dateAdded ? String(dateAdded.value) : '';
      const seen = byKey.get(key) ?? {
        name: answerText(name.value),
        recorded: '',
        consulted: encounter.encounterDatetime,
      };
      if (added && (!seen.recorded || time(added) < time(seen.recorded))) {
        seen.recorded = added;
      }
      if (time(encounter.encounterDatetime) < time(seen.consulted)) {
        seen.consulted = encounter.encounterDatetime;
      }
      byKey.set(key, seen);
    }
  }
  return [...byKey.entries()]
    .map(([key, one]) => ({ key, name: one.name, added: one.recorded || one.consulted }))
    .sort((a, b) => time(b.added) - time(a.added));
}
