import dayjs from 'dayjs';
import useSWR from 'swr';
import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { type DownloadLogEntry } from '../download/download.resource';
import { parseAuditTime } from './log-time';

/** The user a log entry names: ACT Core adds the person's name and ACT role to OpenMRS's username. */
export interface LogUser {
  uuid: string | null;
  username: string | null;
  display?: string | null;
  role?: string | null;
}

export interface LogPage<T> {
  results: Array<T>;
  totalCount: number;
  /** The first day the list covers: ACT Core reads the last 12 months unless a start date is given. */
  from?: string;
  to?: string | null;
}

/** A page of a log, by the row to start at and the rows to fetch. */
export interface Paging {
  startIndex: number;
  limit: number;
}

export const PAGE_SIZES = [20, 50, 100];

/** The most rows a log request may ask for, as ACT Core caps it. */
export const MAX_LIMIT = 100;

/** The filters every tab shares: a username and a date range, ISO dates. */
export interface SharedQuery {
  username?: string;
  startDate?: string;
  endDate?: string;
}

const withParams = (url: string, entries: Record<string, string | number | undefined>) => {
  const params = new URLSearchParams();
  Object.entries(entries).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  });
  return `${url}?${params}`;
};

function usePage<T>(url: string | null, read: (data: unknown) => LogPage<T>) {
  const { data, error, isLoading } = useSWR<LogPage<T>, Error>(
    url,
    async () => read((await openmrsFetch<unknown>(url)).data),
    { keepPreviousData: true },
  );
  return { page: data, error, isLoading };
}

/** ACT Core's page shape; an older ACT Core's download log has no count, so its results are the count. */
const actCorePage = <T>(data: unknown): LogPage<T> => {
  const page = data as { results: Array<T>; totalCount?: number; from?: string; to?: string | null };
  return { results: page.results, totalCount: page.totalCount ?? page.results.length, from: page.from, to: page.to };
};

/** Every page of a log, fetched in turn from the first, with the window the first page names. */
export async function fetchAllLogs<T>(
  urlFor: (paging: Paging) => string,
  read: (data: unknown) => LogPage<T>,
): Promise<LogPage<T>> {
  const all: Array<T> = [];
  let total = Infinity;
  let window: Pick<LogPage<T>, 'from' | 'to'> = {};
  while (all.length < total) {
    const page = read((await openmrsFetch<unknown>(urlFor({ startIndex: all.length, limit: MAX_LIMIT }))).data);
    all.push(...page.results);
    total = page.totalCount;
    window = { from: page.from, to: page.to };
    if (!page.results.length) {
      break;
    }
  }
  return { results: all, totalCount: all.length, ...window };
}

export type ActivityKind =
  | 'saved'
  | 'edited'
  | 'voided'
  | 'registered'
  | 'patientStatus'
  | 'user'
  | 'role'
  | 'clinic'
  | 'study'
  | 'flag'
  | 'other';

export interface ActivityTarget {
  kind: 'patient' | 'user' | 'role' | 'location' | 'program' | 'study' | 'flag' | 'other';
  uuid: string | null;
  display: string | null;
  actId?: string | null;
}

/** One revision of the audit log: an encounter with its observations, a registration, a user change. */
export interface ActivityEntry {
  /** Null for a flag dismissal, which ACT Core records outside the audit log, so it has nothing to expand. */
  revisionId: number | null;
  time: string;
  user: LogUser;
  kind: ActivityKind;
  /** The verb and object, as "Saved RHD BPG Delivery" or "Registered a patient". */
  action: string;
  summary: string | null;
  target: ActivityTarget | null;
  encounter: { uuid: string; form: { uuid: string; name: string } | null; visitDate: string | null } | null;
  ip: string | null;
  userAgent: string | null;
}

export interface ActivityField {
  name: string;
  previous: string | null;
  current: string | null;
}

export interface ActivityDetail {
  revisionId: number;
  fields: Array<ActivityField>;
  voidReason: string | null;
}

export interface ActivityQuery extends SharedQuery {
  kind?: string;
  form?: string;
  patient?: string;
}

export const activityUrl = (query: ActivityQuery, paging: Paging) =>
  withParams(`${restBaseUrl}/actcore/activity`, { ...query, ...paging });

export const useActivity = (query: ActivityQuery, paging: Paging, enabled = true) =>
  usePage<ActivityEntry>(enabled ? activityUrl(query, paging) : null, actCorePage);

export function useActivityDetail(revisionId: number | null) {
  const url = revisionId === null ? null : `${restBaseUrl}/actcore/activity/${revisionId}`;
  const { data, error, isLoading } = useSWR<ActivityDetail, Error>(
    url,
    async () => (await openmrsFetch<ActivityDetail>(url)).data,
  );
  return { detail: data, error, isLoading };
}

export interface ReadPatient {
  uuid: string;
  display: string;
  actId: string | null;
  primaryCareClinic: string | null;
  cardiacClinic: string | null;
}

/** A user's reads of one patient within an hour, or one read of something else, such as a search. */
export interface ReadEntry {
  id: string;
  from: string;
  to: string;
  user: LogUser;
  patient: ReadPatient | null;
  count: number;
  reads: Array<{ time: string; entity: string; description: string }>;
  sessionId: string | null;
  ip: string | null;
  userAgent: string | null;
  /** Null when the user or the patient has no clinic. */
  sameClinicAsUser: boolean | null;
}

export interface ReadsQuery extends SharedQuery {
  patient?: string;
}

export const readsUrl = (query: ReadsQuery, paging: Paging) =>
  withParams(`${restBaseUrl}/actcore/reads`, { ...query, ...paging });

export const useReads = (query: ReadsQuery, paging: Paging, enabled = true) =>
  usePage<ReadEntry>(enabled ? readsUrl(query, paging) : null, actCorePage);

export interface DownloadsQuery extends SharedQuery {
  form?: string;
  identifiers?: string;
}

export const downloadsUrl = (query: DownloadsQuery, paging: Paging) =>
  withParams(`${restBaseUrl}/actcore/download`, { ...query, ...paging });

export const useDownloads = (query: DownloadsQuery, paging: Paging, enabled = true) =>
  usePage<DownloadLogEntry>(enabled ? downloadsUrl(query, paging) : null, actCorePage);

/** Every download that matches, for the tab's summary line and its paging. */
export function useAllDownloads(query: DownloadsQuery) {
  const key = downloadsUrl(query, { startIndex: 0, limit: MAX_LIMIT });
  const { data, error, isLoading } = useSWR<LogPage<DownloadLogEntry>, Error>(
    key,
    () => fetchAllLogs<DownloadLogEntry>((paging) => downloadsUrl(query, paging), actCorePage),
    { keepPreviousData: true },
  );
  return { page: data, error, isLoading };
}

/** The audit log module's security events, as its AuditSecurityEventType names them. */
export type SignInEventType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'ACCOUNT_LOCKED'
  | 'LOGOUT'
  | 'SESSION_TIMEOUT'
  | 'PASSWORD_RESET_REQUEST_SUCCESS'
  | 'PASSWORD_RESET_REQUEST_FAILURE'
  | 'PASSWORD_RESET_SUCCESS'
  | 'PASSWORD_RESET_FAILURE'
  | 'PASSWORD_CHANGED_SUCCESS'
  | 'PASSWORD_CHANGED_FAILURE'
  | 'UNKNOWN';

export interface SignInEntry {
  id: number;
  eventType: SignInEventType;
  username: string | null;
  userUUID: string | null;
  eventTime: string;
  ipAddress: string | null;
  userAgent: string | null;
  sessionId: string | null;
  details: string | null;
}

export interface SignInsQuery extends SharedQuery {
  eventType?: string;
}

/** The audit log module takes its dates as DD/MM/YYYY, and refuses an ISO date. */
const auditModuleDate = (iso: string | undefined) => (iso ? dayjs(iso).format('DD/MM/YYYY') : undefined);

/** The audit log module pages by page number and size, so a page starts at a multiple of its size. */
export const signInsUrl = (query: SignInsQuery, paging: Paging) =>
  withParams(`${restBaseUrl}/securityauditlogs`, {
    ...query,
    startDate: auditModuleDate(query.startDate),
    endDate: auditModuleDate(query.endDate),
    page: Math.floor(paging.startIndex / paging.limit),
    size: paging.limit,
  });

export const signInsPage = (data: unknown): LogPage<SignInEntry> => {
  const page = data as { securityAuditLogs: Array<SignInEntry>; totalLogs: number };
  return {
    results: page.securityAuditLogs.map((entry) => ({ ...entry, eventTime: parseAuditTime(entry.eventTime) })),
    totalCount: page.totalLogs,
  };
};

export const useSignIns = (query: SignInsQuery, paging: Paging, enabled = true) =>
  usePage<SignInEntry>(enabled ? signInsUrl(query, paging) : null, signInsPage);

/** What a CSV the app made itself records in ACT Core's download log, before the file is given. */
export interface DownloadRecord {
  /** registry, worklist:<name> or logs:<tab>. */
  list: string;
  columns: Array<string>;
  rows: number;
  /** Whether the rows name patients. */
  identifiers: boolean;
  filters: Record<string, string>;
}

export function recordDownload(record: DownloadRecord) {
  return openmrsFetch(`${restBaseUrl}/actcore/download/record`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: record,
  });
}
