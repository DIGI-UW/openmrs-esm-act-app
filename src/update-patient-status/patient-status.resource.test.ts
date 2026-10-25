import dayjs from 'dayjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import {
  type Enrolment,
  endEnrolment,
  markDead,
  registryEnrolmentOf,
  statusOf,
  statusOptionsOf,
  terminalStatesOf,
} from './patient-status.resource';

const registry = '7d73e143-a550-5a9d-aecd-dd771add098d';
const deathConcept = '159AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const state = (uuid: string, concept: string, display: string, terminal = true, retired = false) => ({
  uuid,
  terminal,
  retired,
  concept: { uuid: concept, display },
});
const program = {
  allWorkflows: [
    {
      retired: false,
      states: [
        state('active', 'c-active', 'Active', false),
        state('ltfu', 'c-ltfu', 'Lost to follow-up'),
        state('reloc', 'c-reloc', 'Physical relocation'),
        state('dead', deathConcept, 'Deceased'),
        state('old', 'c-old', 'Old state', true, true),
      ],
    },
  ],
};
const enrolment = (overrides: Partial<Enrolment> = {}): Enrolment => ({
  uuid: 'pe',
  dateEnrolled: '2026-01-10T00:00:00.000+0000',
  dateCompleted: null,
  voided: false,
  program: { uuid: registry },
  states: [],
  ...overrides,
});

describe('registryEnrolmentOf', () => {
  it("takes the registry's latest enrolment that is not voided, and no other programme's", () => {
    const latest = enrolment({ uuid: 'latest', dateEnrolled: '2026-05-01T00:00:00.000+0000' });
    const found = registryEnrolmentOf(
      [
        enrolment({ uuid: 'older' }),
        latest,
        enrolment({ uuid: 'voided', dateEnrolled: '2026-09-01T00:00:00.000+0000', voided: true }),
        enrolment({
          uuid: 'other',
          dateEnrolled: '2026-09-01T00:00:00.000+0000',
          program: { uuid: 'other-programme' },
        }),
      ],
      registry,
    );

    expect(found?.uuid).toBe('latest');
    expect(registryEnrolmentOf([], registry)).toBeNull();
  });
});

describe('statusOf', () => {
  it('is null for an active enrolment', () => {
    expect(statusOf(enrolment())).toBeNull();
  });

  it("names the latest state of a completed enrolment by its start, whatever the state's end date is", () => {
    const status = statusOf(
      enrolment({
        dateCompleted: '2026-08-02T00:00:00.000+0000',
        states: [
          {
            startDate: '2026-01-10T00:00:00.000+0000',
            endDate: '2026-08-02T00:00:00.000+0000',
            voided: false,
            state: { uuid: 'active', concept: { uuid: 'c-active', display: 'Active' } },
          },
          {
            startDate: '2026-08-02T00:00:00.000+0000',
            endDate: '2026-08-02T00:00:00.000+0000',
            voided: false,
            state: { uuid: 'ltfu', concept: { uuid: 'c-ltfu', display: 'Lost to follow-up' } },
          },
        ],
      }),
    );

    expect(status).toEqual({ name: 'Lost to follow-up', since: '2026-08-02T00:00:00.000+0000' });
  });

  it('has no name for a completed enrolment that records no state', () => {
    expect(statusOf(enrolment({ dateCompleted: '2026-08-02T00:00:00.000+0000' }))).toEqual({
      name: null,
      since: '2026-08-02T00:00:00.000+0000',
    });
  });
});

describe('terminalStatesOf', () => {
  it("lists the workflow's terminal states that are not retired, marking the Deceased one", () => {
    expect(terminalStatesOf(program, deathConcept)).toEqual([
      { uuid: 'ltfu', name: 'Lost to follow-up', death: false },
      { uuid: 'reloc', name: 'Physical relocation', death: false },
      { uuid: 'dead', name: 'Deceased', death: true },
    ]);
  });
});

describe('statusOptionsOf', () => {
  const states = terminalStatesOf(program, deathConcept);
  const names = (options: ReturnType<typeof statusOptionsOf>) => options.map((one) => one.name);
  const base = { states, enrolmentActive: true, personDead: false, mayEditPrograms: true, mayEditPeople: true };

  it('offers every terminal state to a user who may edit both, for a patient in the registry', () => {
    expect(names(statusOptionsOf(base))).toEqual(['Lost to follow-up', 'Physical relocation', 'Deceased']);
  });

  it('offers a user who may only edit people Deceased alone, and one who may only edit programmes the others', () => {
    expect(names(statusOptionsOf({ ...base, mayEditPrograms: false }))).toEqual(['Deceased']);
    expect(names(statusOptionsOf({ ...base, mayEditPeople: false }))).toEqual([
      'Lost to follow-up',
      'Physical relocation',
    ]);
  });

  it('offers a patient already marked dead, whose enrolment is still active, the Deceased state to end it', () => {
    expect(names(statusOptionsOf({ ...base, personDead: true, mayEditPeople: false }))).toEqual([
      'Lost to follow-up',
      'Physical relocation',
      'Deceased',
    ]);
  });

  it('offers Deceased alone, as a person update, to a patient with no active enrolment who is alive', () => {
    expect(names(statusOptionsOf({ ...base, enrolmentActive: false }))).toEqual(['Deceased']);
    expect(names(statusOptionsOf({ ...base, enrolmentActive: false, mayEditPeople: false }))).toEqual([]);
  });

  it('offers nothing to a patient with no active enrolment who is already dead', () => {
    expect(names(statusOptionsOf({ ...base, enrolmentActive: false, personDead: true }))).toEqual([]);
  });
});

describe('the requests', () => {
  beforeEach(() =>
    vi
      .mocked(openmrsFetch)
      .mockReset()
      .mockResolvedValue({ data: {} } as never),
  );
  const bodyOf = (call: number) => (vi.mocked(openmrsFetch).mock.calls[call][1] as { body: unknown }).body;
  const urlOf = (call: number) => vi.mocked(openmrsFetch).mock.calls[call][0];

  it('marks a person dead with the date and the cause', async () => {
    await markDead('person', '2020-10-24', 'Heart failure');

    expect(urlOf(0)).toBe(`${restBaseUrl}/person/person`);
    expect(bodyOf(0)).toEqual({ dead: true, deathDate: '2020-10-24', causeOfDeathNonCoded: 'Heart failure' });
  });

  it('ends an enrolment on the date in the terminal state', async () => {
    await endEnrolment('pe', 'ltfu', '2020-10-24', '2020-01-10T00:00:00.000+0000');

    expect(urlOf(0)).toBe(`${restBaseUrl}/programenrollment/pe`);
    expect(bodyOf(0)).toEqual({ dateCompleted: '2020-10-24', states: [{ state: 'ltfu', startDate: '2020-10-24' }] });
  });

  it("sends the enrolment's own instant when the date is its day, as a bare day would be before its time", async () => {
    const enrolled = '2026-10-23T11:01:51.000+0000';
    await endEnrolment('pe', 'ltfu', '2026-10-23', enrolled);
    await endEnrolment('pe', 'ltfu', '2026-10-24', enrolled);

    expect(bodyOf(0)).toEqual({ dateCompleted: enrolled, states: [{ state: 'ltfu', startDate: enrolled }] });
    expect(bodyOf(1)).toEqual({ dateCompleted: '2026-10-24', states: [{ state: 'ltfu', startDate: '2026-10-24' }] });
  });

  it('sends today as the present moment, so a clock ahead of the server is not the future', async () => {
    const today = dayjs().format('YYYY-MM-DD');
    await markDead('person', today, 'Heart failure');
    await endEnrolment('pe', 'ltfu', today, '2020-01-10T00:00:00.000+0000');

    const sent = [
      (bodyOf(0) as { deathDate: string }).deathDate,
      (bodyOf(1) as { dateCompleted: string }).dateCompleted,
    ];
    for (const value of sent) {
      expect(value).toMatch(/T\d\d:\d\d:\d\d/);
      expect(Math.abs(new Date(value).getTime() - Date.now())).toBeLessThan(60_000);
    }
  });
});
