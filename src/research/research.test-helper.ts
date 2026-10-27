import { vi } from 'vitest';
import { openmrsFetch } from '@openmrs/esm-framework';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

export const yes = '1065AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
export const no = '1066AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
export const optInType = 'a78f6ae3-faec-5db8-9493-53877985ca7f';
export const consentType = 'e15bf9b7-249e-5d75-907d-937b8d9b0c46';
export const studyIdType = '7840ba5d-d927-52d6-907b-dd070bea6626';

export const states = [
  { uuid: 'arc-active', name: 'Active', initial: true, terminal: false },
  { uuid: 'arc-withdrawn', name: 'Inactive - Voluntary withdrawal', initial: false, terminal: true },
  { uuid: 'arc-lost', name: 'Inactive - Lost to follow-up', initial: false, terminal: true },
];
export const studies = [
  { uuid: 'arc', name: 'ARC', states },
  {
    uuid: 'miller',
    name: 'Miller',
    states: [
      { uuid: 'miller-active', name: 'Active', initial: true, terminal: false },
      { uuid: 'miller-withdrawn', name: 'Inactive - Voluntary withdrawal', initial: false, terminal: true },
    ],
  },
];
export const arcEnrollment = {
  uuid: 'enrollment-arc',
  program: { uuid: 'arc' },
  dateEnrolled: '2026-09-01T00:00:00.000+0000',
  dateCompleted: null,
  attributes: [{ uuid: 'attr-1', value: 'ARC-0042', voided: false, attributeType: { uuid: studyIdType } }],
  states: [
    {
      uuid: 's1',
      startDate: '2026-09-01T00:00:00.000+0000',
      endDate: null,
      voided: false,
      state: { uuid: 'arc-active' },
      auditInfo: { dateCreated: '2026-09-01T09:00:00.000+0000' },
    },
  ],
};
export const registryEnrollment = {
  uuid: 'enrollment-registry',
  program: { uuid: 'rhd-registry' },
  dateEnrolled: '2026-01-01T00:00:00.000+0000',
  dateCompleted: null,
  attributes: [],
  states: [],
};

export function backendAnswers({
  optIn = yes,
  consent = yes,
  dead = false,
  enrollments = [arcEnrollment, registryEnrollment],
  personFails = false,
  saveFails,
}: {
  optIn?: string | null;
  consent?: string | null;
  dead?: boolean;
  enrollments?: Array<unknown>;
  personFails?: boolean;
  /** The REST error body a failed save responds with. */
  saveFails?: unknown;
} = {}) {
  const posts: Array<{ url: string; body: unknown }> = [];
  mockOpenmrsFetch.mockImplementation(async (url: string, init?: { method?: string; body?: unknown }) => {
    if (init?.method === 'POST') {
      posts.push({ url, body: init.body });
      if (saveFails) {
        throw Object.assign(new Error('Server responded with 400 (Bad Request)'), { responseBody: saveFails });
      }
      return { data: {} } as never;
    }
    if (url.endsWith('/actcore/studies')) {
      return { data: { results: studies } } as never;
    }
    if (url.includes('/programenrollment?patient=patient-1')) {
      return { data: { results: enrollments } } as never;
    }
    if (url.includes('/person/patient-1')) {
      if (personFails) {
        throw new Error('person fetch failed');
      }
      return {
        data: {
          dead,
          attributes: [
            ...(optIn ? [{ uuid: 'opt-in-attr', value: { uuid: optIn }, attributeType: { uuid: optInType } }] : []),
            ...(consent
              ? [{ uuid: 'consent-attr', value: { uuid: consent }, attributeType: { uuid: consentType } }]
              : []),
          ],
        },
      } as never;
    }
    throw new Error(`unexpected ${url}`);
  });
  return posts;
}

/** A status that started and ended on the day given, as core closes the one that completes an enrolment. */
export const closedState = (uuid: string, state: string, day: string, recorded = `${day}T09:00:00.000+0000`) => ({
  uuid,
  startDate: `${day}T00:00:00.000+0000`,
  endDate: `${day}T00:00:00.000+0000`,
  voided: false,
  state: { uuid: state },
  auditInfo: { dateCreated: recorded },
});
