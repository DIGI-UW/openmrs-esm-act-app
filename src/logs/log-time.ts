import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import utc from 'dayjs/plugin/utc';
import { formatDate } from '@openmrs/esm-framework';

dayjs.extend(customParseFormat);
dayjs.extend(utc);

/** The audit log module writes times as 21/10/2026 20:42:49, in UTC whatever zone the server runs in. */
const auditModuleFormat = 'DD/MM/YYYY HH:mm:ss';

/** An ISO time from the audit log module's own format; a time in any other format is kept as it is. */
export function parseAuditTime(value: string) {
  const parsed = dayjs.utc(value, auditModuleFormat, true);
  return parsed.isValid() ? parsed.toISOString() : value;
}

/** A row's time: "Today, 10:52" or "Yesterday, 17:05" for recent entries, else the full date and time. */
export function logTime(iso: string, now = new Date()) {
  const time = dayjs(iso);
  const clock = time.format('HH:mm');
  if (time.isSame(now, 'day')) {
    return `Today, ${clock}`;
  }
  if (time.isSame(dayjs(now).subtract(1, 'day'), 'day')) {
    return `Yesterday, ${clock}`;
  }
  return `${formatDate(time.toDate(), { time: false, noToday: true })}, ${clock}`;
}

/** A row's time window, "Today, 07:41 to 07:48", for reads folded into one row; one read shows its time alone. */
export function logTimeRange(from: string, to: string, now = new Date()) {
  const start = logTime(from, now);
  return dayjs(to).diff(from, 'minute') < 1 ? start : `${start} to ${dayjs(to).format('HH:mm')}`;
}

/** The exact timestamp, to the second, for the expanded row. */
export const fullTime = (iso: string) =>
  `${formatDate(new Date(iso), { time: false, noToday: true })}, ${dayjs(iso).format('HH:mm:ss')}`;

const browsers: Array<[RegExp, string]> = [
  [/Edg\//, 'Edge'],
  [/OPR\//, 'Opera'],
  [/Firefox\//, 'Firefox'],
  [/Chrome\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];

const systems: Array<[RegExp, string]> = [
  [/Android/, 'Android'],
  [/iPhone|iPad/, 'iOS'],
  [/Windows/, 'Windows'],
  [/Mac OS X/, 'macOS'],
  [/Linux/, 'Linux'],
];

/** "Chrome on macOS" from a browser's user agent, or the agent itself when it is not a known browser. */
export function describeBrowser(userAgent: string | null | undefined) {
  if (!userAgent) {
    return '';
  }
  const browser = browsers.find(([pattern]) => pattern.test(userAgent))?.[1];
  const system = systems.find(([pattern]) => pattern.test(userAgent))?.[1];
  if (!browser) {
    return userAgent;
  }
  return system ? `${browser} on ${system}` : browser;
}

/**
 * The audit log module's security details in words: it writes a failed sign-in as JSON
 * ({"failureReason": "Invalid credential", "accountLocked": false}); anything else is kept as it is.
 */
export function describeSignInDetails(details: string | null | undefined) {
  if (!details) {
    return '';
  }
  try {
    const parsed = JSON.parse(details) as { failureReason?: string; accountLocked?: boolean };
    if (typeof parsed !== 'object' || parsed === null) {
      return details;
    }
    return [parsed.failureReason, parsed.accountLocked ? 'account locked' : null].filter(Boolean).join(', ') || details;
  } catch {
    return details;
  }
}

/** Where a request came from: "172.21.0.1, Chrome on macOS". */
export const describeClient = (ip: string | null | undefined, userAgent: string | null | undefined) =>
  [ip, describeBrowser(userAgent)].filter(Boolean).join(', ');
