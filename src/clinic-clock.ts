import dayjs from 'dayjs';
import { getConfig } from '@openmrs/esm-framework';
import { type Config } from './config-schema';

let timeZone = 'Africa/Kampala';

/** Keeps the clinic clock on the config's timeZone, read once the app's config has loaded. */
export function registerClinicTimeZone() {
  getConfig('@act-registry/esm-act-app').then((config) => setClinicTimeZone((config as Config).timeZone));
}

export function setClinicTimeZone(zone: string) {
  timeZone = zone;
}

/**
 * The clinic's wall clock at an instant, as a Date whose local fields read the clinic's date and time, so a laptop set
 * to another time zone still counts the clinic's day. Use it for calendar days, never for elapsed time.
 */
export function clinicClock(at: Date = new Date()): Date {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    })
      .formatToParts(at)
      .map((part) => [part.type, Number(part.value)]),
  );
  return new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second, at.getMilliseconds());
}

/** The clinic's date today, YYYY-MM-DD. */
export const clinicToday = () => dayjs(clinicClock()).format('YYYY-MM-DD');
