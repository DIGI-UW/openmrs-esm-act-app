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
 * The patient's cardiac medications across their consultations (newest first), one row per medicine and start date.
 * A medicine recorded again by a later consultation shows once, as that latest record has it, and its start is the
 * Date Started it records or else the first consultation that recorded it. Only a Date Stopped ends a medicine, so
 * a medicine left out of a later consultation without one stays active. Active rows come newest start first, past
 * rows newest stop first.
 */
export function toMedications(encounters: Array<ChartEncounter>, concepts: Concepts) {
  const byKey = new Map<string, Medication & { firstSeen: string }>();
  for (const encounter of encounters) {
    for (const group of answersIn(encounter.obs, concepts.medication)) {
      const [medicine] = answersIn(group.groupMembers, concepts.medication);
      if (!medicine) {
        continue;
      }
      const text = (concept: string) => {
        const [one] = answersIn(group.groupMembers, concept);
        return one ? answerText(one.value) : '';
      };
      const dateStarted = text(concepts.dateStarted);
      const key = `${answerUuid(medicine.value)}|${dateStarted}`;
      const seen = byKey.get(key);
      if (seen) {
        // An older copy of the same medicine: only the first consultation to record it can move its start back.
        if (time(encounter.encounterDatetime) < time(seen.firstSeen)) {
          seen.firstSeen = encounter.encounterDatetime;
          seen.started = dateStarted || encounter.encounterDatetime;
        }
        continue;
      }
      byKey.set(key, {
        key,
        name: answerText(medicine.value),
        dose: text(concepts.medicationDose),
        interval: text(concepts.medicationInterval),
        started: dateStarted || encounter.encounterDatetime,
        stopped: text(concepts.dateStopped) || null,
        firstSeen: encounter.encounterDatetime,
      });
    }
  }
  const all = [...byKey.values()];
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
