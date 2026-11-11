import dayjs from 'dayjs';
import { formatDate, parseDate } from '@openmrs/esm-framework';
import { clinicClock } from '../clinic-clock';

export type DueTone = 'red' | 'yellow' | 'green';

/** How many days ahead counts as due soon: 48 hours after today. */
export const DUE_SOON_DAYS = 2;

/** Days from today to a YYYY-MM-DD due date, negative once it has passed. */
export function daysUntil(nextDue: string, now = clinicClock()) {
  return dayjs(nextDue).startOf('day').diff(dayjs(now).startOf('day'), 'day');
}

/** Red once the date has passed, yellow when it falls today or in the next 48 hours, green after that. */
export function dueTone(days: number): DueTone {
  if (days < 0) {
    return 'red';
  }
  return days <= DUE_SOON_DAYS ? 'yellow' : 'green';
}

/** 15-Oct, with the year only when it is not this year's. */
export function shortDate(date: string, now = clinicClock()) {
  const parsed = parseDate(date);
  return formatDate(parsed, { time: false, noToday: true, year: parsed.getFullYear() !== now.getFullYear() });
}

export const fullDate = (date: string) => formatDate(parseDate(date), { time: false, noToday: true });
