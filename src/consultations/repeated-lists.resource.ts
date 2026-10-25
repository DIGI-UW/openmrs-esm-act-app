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
 * The patient's cardiac medications across their consultations, one row per course of a medicine. Records are read
 * oldest to newest per medicine: a Date Stopped closes the medicine's open row; a record without one updates the open
 * row in place (dose, interval, a Date Started it fills), or opens a new row when there is none or its Date Started is
 * later than the open row's recorded start. A row's start is the Date Started it records or else the first
 * consultation that recorded it. Only a Date Stopped ends a medicine, so a medicine left out of a later consultation
 * stays active. Active rows come newest start first, past rows newest stop first.
 */
export function toMedications(encounters: Array<ChartEncounter>, concepts: Concepts) {
  const rows: Array<Medication & { recorded: boolean }> = [];
  const open = new Map<string, Medication & { recorded: boolean }>();
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
      if (current && (stopped || !dateStarted || !current.recorded || time(dateStarted) <= time(current.started))) {
        current.dose = text(concepts.medicationDose) || current.dose;
        current.interval = text(concepts.medicationInterval) || current.interval;
        if (dateStarted && !current.recorded) {
          current.started = dateStarted;
          current.recorded = true;
        }
        if (stopped) {
          current.stopped = stopped;
          open.delete(uuid);
        }
        continue;
      }
      const row = {
        key: `${uuid}|${rows.length}`,
        name: answerText(medicine.value),
        dose: text(concepts.medicationDose),
        interval: text(concepts.medicationInterval),
        started: dateStarted || encounter.encounterDatetime,
        stopped,
        recorded: Boolean(dateStarted),
      };
      rows.push(row);
      if (stopped) {
        open.delete(uuid);
      } else {
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
 * One of the consultation's repeated lists (chronic conditions, allergies, RHD complications): each item once, however
 * many consultations record it, newest first. An item's date is the Date Added it records or else the first
 * consultation that recorded it.
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
