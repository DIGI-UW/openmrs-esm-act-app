import dayjs from 'dayjs';
import { type DownloadLogEntry } from '../download/download.resource';
import { type ActivityDetail, type ActivityEntry, type ReadEntry, type SignInEntry } from './logs.resource';

/** A time of today, or of `daysAgo` days ago, at the given clock time, as the server would write it. */
export const at = (clock: string, daysAgo = 0) =>
  dayjs().subtract(daysAgo, 'day').format(`YYYY-MM-DD[T]${clock}.000[Z]`);

const clinician = { uuid: 'u-clinician', username: 'clinician', display: 'Sarah Namusoke', role: 'Clinician' };
const community = {
  uuid: 'u-cc',
  username: 'communityClinician',
  display: 'Joseph Odongo',
  role: 'Community Clinician',
};
const siteAdmin = { uuid: 'u-sa', username: 'siteAdmin', display: 'Peter Ocen', role: 'Site Administrator' };
const grace = { kind: 'patient' as const, uuid: 'p-grace', display: 'Grace Akello', actId: 'rhd00001' };

export const activityEntries: Array<ActivityEntry> = [
  {
    revisionId: 1234,
    time: at('10:52:14'),
    user: clinician,
    kind: 'saved',
    action: 'Saved RHD BPG Delivery',
    summary: '6 fields set',
    target: grace,
    encounter: { uuid: 'e-1', form: { uuid: 'f-bpg', name: 'RHD BPG Delivery' }, visitDate: '2026-10-21' },
    ip: '172.21.0.1',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/130.0.0.0 Safari/537.36',
  },
  {
    revisionId: 1233,
    time: at('10:40:00'),
    user: community,
    kind: 'edited',
    action: 'Edited RHD Oral Adherence',
    summary: '2 fields changed: Date of Adherence Estimate, Adherence',
    target: { kind: 'patient', uuid: 'p-samuel', display: 'Samuel Okello', actId: 'rhd00002' },
    encounter: { uuid: 'e-2', form: { uuid: 'f-oral', name: 'RHD Oral Adherence' }, visitDate: '2026-10-19' },
    ip: null,
    userAgent: null,
  },
  {
    revisionId: 1232,
    time: at('09:15:00'),
    user: clinician,
    kind: 'voided',
    action: 'Voided RHD Echocardiogram',
    summary: 'Reason: entered on the wrong patient',
    target: { kind: 'patient', uuid: 'p-lakot', display: 'Lakot Lamwaka', actId: 'rhd00409' },
    encounter: { uuid: 'e-3', form: { uuid: 'f-echo', name: 'RHD Echocardiogram' }, visitDate: '2026-10-21' },
    ip: null,
    userAgent: null,
  },
  {
    revisionId: null,
    time: at('08:30:00'),
    user: { uuid: 'u-dc', username: 'dataClerk', display: 'Mary Achen', role: 'Data Clerk' },
    kind: 'flag',
    action: 'Dismissed flag RHD prophylaxis not prescribed',
    summary: 'Reason: prescribed elsewhere',
    target: { kind: 'patient', uuid: 'p-agnes', display: 'Agnes Lamwaka', actId: 'rhd00031' },
    encounter: null,
    ip: null,
    userAgent: null,
  },
  {
    revisionId: 1230,
    time: at('17:05:00', 1),
    user: { uuid: 'u-ia', username: 'instanceAdmin', display: 'James Kato', role: 'Instance Administrator' },
    kind: 'user',
    action: 'Created user Data Clerk at Acimi HCIII',
    summary: null,
    target: { kind: 'user', uuid: 'u-dc2', display: 'Mary Achen', actId: null },
    encounter: null,
    ip: null,
    userAgent: null,
  },
];

export const activityDetails: Record<number, ActivityDetail> = {
  1234: {
    revisionId: 1234,
    fields: [
      { name: 'Date of Injection', previous: null, current: '21-Oct-2026' },
      { name: 'Dose given', previous: null, current: '1.2 MU (1,200,000 units)' },
    ],
    voidReason: null,
  },
  1233: {
    revisionId: 1233,
    fields: [
      { name: 'Date of Adherence Estimate', previous: '12-Oct-2026', current: '19-Oct-2026' },
      { name: 'Adherence', previous: '60%', current: '80%' },
    ],
    voidReason: null,
  },
  1232: { revisionId: 1232, fields: [], voidReason: 'entered on the wrong patient' },
  1230: { revisionId: 1230, fields: [{ name: 'Roles', previous: null, current: 'Data Clerk' }], voidReason: null },
};

export const readEntries: Array<ReadEntry> = [
  {
    id: 'communityClinician:p-grace:07',
    from: at('07:41:20'),
    to: at('07:48:17'),
    user: community,
    patient: {
      uuid: 'p-grace',
      display: 'Grace Akello',
      actId: 'rhd00001',
      primaryCareClinic: 'Akunalaber HCIII',
      cardiacClinic: 'Gulu Regional Referral Hospital',
    },
    count: 3,
    reads: [
      {
        time: at('07:41:20'),
        entity: 'Patient',
        description: 'the patient record, 2 encounters and their 9 observations',
      },
      { time: at('07:44:00'), entity: 'Encounter', description: 'the BPG Delivery encounters' },
      { time: at('07:48:17'), entity: 'Encounter', description: 'every encounter' },
    ],
    sessionId: 'ED97E5A1',
    ip: '172.21.0.1',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/130.0.0.0 Safari/537.36',
    sameClinicAsUser: true,
  },
  {
    id: 'communityClinician:p-patrick:07',
    from: at('07:17:00'),
    to: at('07:17:00'),
    user: community,
    patient: {
      uuid: 'p-patrick',
      display: 'Patrick Ojok',
      actId: 'rhd00004',
      primaryCareClinic: 'Uganda Heart Institute',
      cardiacClinic: null,
    },
    count: 1,
    reads: [{ time: at('07:17:00'), entity: 'Patient', description: 'the patient record' }],
    sessionId: 'ED97E5A1',
    ip: '172.21.0.1',
    userAgent: null,
    sameClinicAsUser: false,
  },
  {
    id: 'communityClinician:search:16',
    from: at('16:02:00', 1),
    to: at('16:02:00', 1),
    user: community,
    patient: null,
    count: 1,
    reads: [{ time: at('16:02:00', 1), entity: 'Patient search', description: 'Searched for "Akello", 4 results' }],
    sessionId: 'ED97E5A0',
    ip: '172.21.0.1',
    userAgent: null,
    sameClinicAsUser: null,
  },
];

export const downloadEntries: Array<DownloadLogEntry> = [
  {
    date: at('10:50:31'),
    user: clinician,
    form: { uuid: 'f-bpg', name: 'RHD BPG Delivery' },
    list: null,
    detail: {
      fields: ['ACT ID', 'Given name', 'Date of Injection'],
      withheld: [],
      startDate: null,
      endDate: null,
      rows: 8,
      identifiers: true,
      researchOnly: false,
    },
  },
  {
    date: at('10:49:00'),
    user: { uuid: 'u-ia', username: 'instanceAdmin', display: 'James Kato', role: 'Instance Administrator' },
    form: { uuid: 'f-consult', name: 'RHD Consultation Visit' },
    list: null,
    detail: {
      fields: ['Date of Consultation Visit'],
      withheld: ['Given name', 'Primary Phone'],
      startDate: '2026-07-01',
      endDate: '2026-09-30',
      rows: 412,
      identifiers: false,
      researchOnly: false,
    },
  },
  {
    date: at('09:03:00', 1),
    user: siteAdmin,
    form: null,
    list: { name: 'Registry list', kind: 'registry' },
    detail: {
      fields: ['Name', 'ACT ID', 'Age', 'Sex'],
      withheld: [],
      startDate: null,
      endDate: null,
      rows: 486,
      identifiers: true,
      researchOnly: false,
    },
  },
];

export const signInEntries: Array<SignInEntry> = [
  {
    id: 91,
    eventType: 'LOGIN_SUCCESS',
    username: 'communityClinician',
    userUUID: 'u-cc',
    eventTime: at('07:39:00'),
    ipAddress: '172.21.0.1',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/130.0.0.0 Safari/537.36',
    sessionId: 'ED97E5A1',
    details: null,
  },
  {
    id: 90,
    eventType: 'LOGIN_FAILURE',
    username: 'communityClinician',
    userUUID: null,
    eventTime: at('07:38:00'),
    ipAddress: '172.21.0.1',
    userAgent: null,
    sessionId: null,
    details: '{"failureReason":"Invalid credential","accountLocked":false}',
  },
  {
    id: 80,
    eventType: 'LOGOUT',
    username: 'dataClerk',
    userUUID: 'u-dc',
    eventTime: at('18:10:00', 1),
    ipAddress: '172.21.0.9',
    userAgent: null,
    sessionId: 'AB12',
    details: null,
  },
];
