import { parseDate } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { answersIn, answerText, type ChartEncounter } from './consultations.resource';

type Concepts = Config['consultations']['concepts'];

const answerUuid = (value: unknown) =>
  typeof value === 'object' && value !== null ? String((value as { uuid?: string }).uuid ?? '') : '';

const time = (date: string) => parseDate(date).getTime();

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
