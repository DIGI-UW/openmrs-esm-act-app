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

type MedicationRow = Medication & { uuid: string; recorded: boolean };

/**
 * The patient's cardiac medications, one row per course of a medicine, read oldest consultation first.
 * Only a Date Stopped ends a course; a later record of an open medicine updates its row instead of adding one.
 */
export function toMedications(encounters: Array<ChartEncounter>, concepts: Concepts) {
  const rows: Array<MedicationRow> = [];
  const open = new Map<string, MedicationRow>();
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
      const stopped = text(concepts.dateStopped) || null;
      const current = open.get(uuid);
      if (current) {
        current.dose = text(concepts.medicationDose) || current.dose;
        current.interval = text(concepts.medicationInterval) || current.interval;
        if (dateStarted && (!current.recorded || time(dateStarted) < time(current.started))) {
          current.started = dateStarted;
          current.recorded = true;
        }
        if (stopped) {
          current.stopped = stopped;
          open.delete(uuid);
        }
        continue;
      }
      const earlier = rows.filter((one) => one.uuid === uuid);
      if (stopped) {
        if (earlier.some((one) => time(one.stopped!) === time(stopped))) {
          continue;
        }
      } else if (
        earlier.length &&
        !(dateStarted && time(dateStarted) > Math.max(...earlier.map((one) => time(one.stopped!))))
      ) {
        continue;
      }
      const row = {
        key: `${uuid}|${rows.length}`,
        uuid,
        name: answerText(medicine.value),
        dose: text(concepts.medicationDose),
        interval: text(concepts.medicationInterval),
        started: dateStarted || encounter.encounterDatetime,
        stopped,
        recorded: Boolean(dateStarted),
      };
      rows.push(row);
      if (!stopped) {
        open.set(uuid, row);
      }
    }
  }
  return {
    active: rows.filter((one) => !one.stopped).sort((a, b) => time(b.started) - time(a.started)),
    past: rows.filter((one) => one.stopped).sort((a, b) => time(b.stopped!) - time(a.stopped!)),
  };
}

export interface ListedItem {
  key: string;
  name: string;
  added: string;
}

/**
 * One of the consultation's repeated lists, each item once, newest first.
 * An item's date is the Date Added it records or else the first consultation that recorded it.
 */
export function toListedItems(encounters: Array<ChartEncounter>, concepts: Concepts, list: string): Array<ListedItem> {
  const byName = new Map<string, ListedItem>();
  for (const encounter of encounters) {
    for (const group of answersIn(encounter.obs, list)) {
      const [name] = answersIn(group.groupMembers, list);
      if (!name) {
        continue;
      }
      const key = answerUuid(name.value) || answerText(name.value);
      const [dateAdded] = answersIn(group.groupMembers, concepts.dateAdded);
      const added = dateAdded ? String(dateAdded.value) : encounter.encounterDatetime;
      const seen = byName.get(key);
      if (!seen) {
        byName.set(key, { key, name: answerText(name.value), added });
      } else if (!dateAdded && time(added) < time(seen.added)) {
        seen.added = added;
      }
    }
  }
  return [...byName.values()].sort((a, b) => time(b.added) - time(a.added));
}
