import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDefaultsFromConfigSchema, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { type Config, configSchema } from '../config-schema';
import {
  type PrescriptionEncounter,
  currentPrescriptionOf,
  prescriptionPayload,
  savePrescription,
} from './prescription.resource';

const { concepts } = (getDefaultsFromConfigSchema(configSchema) as Config).prophylaxisUpdate;
const coded = (uuid: string, display: string) => ({ uuid, display });
const obs = (concept: string, value: unknown, groupMembers?: Array<unknown>, uuid = `${concept}-${Math.random()}`) => ({
  uuid,
  concept: { uuid: concept },
  value,
  groupMembers,
});
const q28 = coded('50be4b26-6c5b-5aaa-9254-3bfd313b4522', 'Q28 day BPG');
const oral = coded('b9884219-358a-594b-94f5-f8a8863a25f3', 'Oral penicillin V');
const none = coded(concepts.none, 'None');

const group = (regimen: object, started: string | null, stopped?: string, uuid?: string) =>
  obs(
    concepts.prescription,
    null,
    [
      obs(concepts.prescription, regimen),
      ...(started ? [obs(concepts.dateStarted, started)] : []),
      ...(stopped ? [obs(concepts.dateStopped, stopped), obs(concepts.reasonStopped, coded('r', 'Allergy'))] : []),
    ],
    uuid,
  );

const encounter = (uuid: string, datetime: string, obsList: Array<unknown>): PrescriptionEncounter =>
  ({ uuid, encounterDatetime: datetime, encounterType: { uuid: 'type' }, obs: obsList }) as PrescriptionEncounter;

describe('currentPrescriptionOf', () => {
  it('reads the unstopped groups of the latest day that holds a prescription, and its duration', () => {
    const current = currentPrescriptionOf(
      [
        encounter('old', '2026-01-10T09:00:00.000+0000', [group(oral, '2026-01-10')]),
        encounter('new', '2026-06-10T09:00:00.000+0000', [
          group(q28, '2026-06-10'),
          obs(concepts.duration, coded('d1', '2 years and reassess')),
        ]),
        encounter('other', '2026-09-01T09:00:00.000+0000', [obs('something-else', 1)]),
      ],
      concepts,
    );

    expect(current?.encounter.uuid).toBe('new');
    expect(current?.groups.map((one) => [one.regimen.label, one.started])).toEqual([['Q28 day BPG', '2026-06-10']]);
    expect(current?.duration?.label).toBe('2 years and reassess');
  });

  it('has no current groups when the latest prescription is stopped, a None answer or has no start date', () => {
    for (const latest of [group(q28, '2026-06-10', '2026-07-01'), group(none, '2026-06-10'), group(q28, null)]) {
      const current = currentPrescriptionOf(
        [
          encounter('old', '2026-01-10T09:00:00.000+0000', [group(oral, '2026-01-10')]),
          encounter('new', '2026-06-10T09:00:00.000+0000', [latest]),
        ],
        concepts,
      );
      expect(current?.encounter.uuid).toBe('new');
      expect(current?.groups).toEqual([]);
    }
  });

  it('keeps the first encounter of a day, as ACT Core does', () => {
    const current = currentPrescriptionOf(
      [
        encounter('second', '2026-06-10T15:00:00.000+0000', [group(oral, '2026-06-10')]),
        encounter('first', '2026-06-10T08:00:00.000+0000', [group(q28, '2026-06-10')]),
      ],
      concepts,
    );

    expect(current?.encounter.uuid).toBe('first');
    expect(current?.groups[0].regimen.label).toBe('Q28 day BPG');
  });

  it('dates an encounter by its Consultation Date when it has one', () => {
    const current = currentPrescriptionOf(
      [
        encounter('backdated', '2026-09-01T09:00:00.000+0000', [
          obs(concepts.consultationDate, '2026-03-01T00:00:00.000+0000'),
          group(oral, '2026-03-01'),
        ]),
        encounter('plain', '2026-06-10T09:00:00.000+0000', [group(q28, '2026-06-10')]),
      ],
      concepts,
    );

    expect(current?.encounter.uuid).toBe('plain');
  });

  it('orders the groups in force by start date and takes the last-started as main', () => {
    const current = currentPrescriptionOf(
      [
        encounter('e', '2026-06-10T09:00:00.000+0000', [
          group(q28, '2026-06-10', undefined, 'later'),
          group(oral, '2026-05-01', undefined, 'earlier'),
        ]),
      ],
      concepts,
    );

    expect(current?.groups.map((one) => one.uuid)).toEqual(['earlier', 'later']);
    expect(current?.main?.uuid).toBe('later');
  });

  it('has no main when nothing is in force', () => {
    const current = currentPrescriptionOf(
      [encounter('e', '2026-06-10T09:00:00.000+0000', [group(q28, '2026-06-10', '2026-07-01')])],
      concepts,
    );

    expect(current?.main).toBeNull();
  });

  it('is null for a patient with no prescription', () => {
    expect(currentPrescriptionOf([encounter('e', '2026-06-10T09:00:00.000+0000', [])], concepts)).toBeNull();
  });
});

describe('prescriptionPayload', () => {
  const patient = 'patient';
  const regimen = (uuid: string) => ({ uuid, label: '' });
  const memberOf = (member: { concept: string; value: unknown }[], concept: string) =>
    member.find((one) => one.concept === concept)?.value;

  const startedOf = (one: { groupMembers?: Array<{ concept: string; value: unknown }> }) =>
    memberOf(one.groupMembers!, concepts.dateStarted);
  const regimenOf = (one: { groupMembers?: Array<{ concept: string; value: unknown }> }) =>
    memberOf(one.groupMembers!, concepts.prescription);

  it('on a switch saves the new group and carries the main one and every other unchanged, with the duration', () => {
    const current = currentPrescriptionOf(
      [
        encounter('e', '2026-06-10T09:00:00.000+0000', [
          group(q28, '2026-06-10', undefined, 'main'),
          group(oral, '2026-05-01', undefined, 'other'),
        ]),
      ],
      concepts,
    );
    const obsList = prescriptionPayload(
      patient,
      concepts,
      current!.groups,
      { regimen: regimen('2f3ee632-dd14-51b0-a4ec-de10e7958019'), started: '2026-10-25', duration: 'dur' },
      'main',
    );

    const groups = obsList.filter((one) => one.concept === concepts.prescription);
    expect(groups).toHaveLength(3);
    expect(regimenOf(groups[0])).toBe('2f3ee632-dd14-51b0-a4ec-de10e7958019');
    expect(startedOf(groups[0])).toBe('2026-10-25');
    expect([regimenOf(groups[1]), startedOf(groups[1])]).toEqual([q28.uuid, '2026-06-10']);
    expect([regimenOf(groups[2]), startedOf(groups[2])]).toEqual([oral.uuid, '2026-05-01']);
    expect(obsList.find((one) => one.concept === concepts.duration)?.value).toBe('dur');
  });

  it('on a switch from Q28 started 2025-01-01 to Q21 today holds both groups, so ACT Core scores each start', () => {
    const current = currentPrescriptionOf(
      [encounter('e', '2025-01-01T09:00:00.000+0000', [group(q28, '2025-01-01', undefined, 'main')])],
      concepts,
    );
    const q21 = '2f3ee632-dd14-51b0-a4ec-de10e7958019';
    const obsList = prescriptionPayload(
      patient,
      concepts,
      current!.groups,
      { regimen: regimen(q21), started: '2026-10-25' },
      'main',
    );

    expect(obsList.map((one) => [regimenOf(one), startedOf(one)])).toEqual([
      [q21, '2026-10-25'],
      [q28.uuid, '2025-01-01'],
    ]);
  });

  it('on a correction of the same start replaces the main group with the edited one', () => {
    const current = currentPrescriptionOf(
      [encounter('e', '2025-01-01T09:00:00.000+0000', [group(q28, '2025-01-01', undefined, 'main')])],
      concepts,
    );
    const q21 = '2f3ee632-dd14-51b0-a4ec-de10e7958019';
    const obsList = prescriptionPayload(
      patient,
      concepts,
      current!.groups,
      { regimen: regimen(q21), started: '2025-01-01' },
      'main',
    );

    expect(obsList.map((one) => [regimenOf(one), startedOf(one)])).toEqual([[q21, '2025-01-01']]);
  });

  it('stops every prescription in force, each with its own regimen and start', () => {
    const current = currentPrescriptionOf(
      [
        encounter('e', '2026-06-10T09:00:00.000+0000', [
          group(oral, '2026-05-01', undefined, 'other'),
          group(q28, '2026-06-10', undefined, 'main'),
        ]),
      ],
      concepts,
    );
    const obsList = prescriptionPayload(
      patient,
      concepts,
      current!.groups,
      { regimen: regimen(q28.uuid), started: '2026-06-10', stop: { stopped: '2026-10-25', reason: 'why' } },
      'main',
    );

    expect(obsList.map((one) => [regimenOf(one), startedOf(one)])).toEqual([
      [q28.uuid, '2026-06-10'],
      [oral.uuid, '2026-05-01'],
    ]);
    for (const one of obsList) {
      expect(memberOf(one.groupMembers!, concepts.dateStopped)).toBe('2026-10-25');
      expect(memberOf(one.groupMembers!, concepts.reasonStopped)).toBe('why');
    }
  });

  it('records a stop as a group with its Date Started, Date Stopped and Reason Stopped', () => {
    const current = currentPrescriptionOf(
      [encounter('e', '2026-06-10T09:00:00.000+0000', [group(q28, '2026-06-10', undefined, 'main')])],
      concepts,
    );
    const obsList = prescriptionPayload(
      patient,
      concepts,
      current!.groups,
      {
        regimen: regimen(q28.uuid),
        started: '2026-06-10',
        stop: { stopped: '2026-10-25', reason: 'eaf16fa9-03d7-5846-94c3-b02805889ed9' },
      },
      'main',
    );

    const [stopped] = obsList;
    expect(memberOf(stopped.groupMembers!, concepts.dateStarted)).toBe('2026-06-10');
    expect(memberOf(stopped.groupMembers!, concepts.dateStopped)).toBe('2026-10-25');
    expect(memberOf(stopped.groupMembers!, concepts.reasonStopped)).toBe('eaf16fa9-03d7-5846-94c3-b02805889ed9');
    expect(obsList).toHaveLength(1);
  });

  it('starts a prescription for a patient with none', () => {
    const obsList = prescriptionPayload(
      patient,
      concepts,
      [],
      { regimen: regimen(oral.uuid), started: '2026-10-25' },
      null,
    );

    expect(obsList).toHaveLength(1);
    expect(memberOf(obsList[0].groupMembers!, concepts.prescription)).toBe(oral.uuid);
  });
});

describe('savePrescription', () => {
  const common = {
    patient: 'patient',
    location: 'gulu',
    encounterType: 'update-type',
    concepts,
    edit: { regimen: { uuid: q28.uuid, label: 'Q28 day BPG' }, started: '2026-10-25', duration: 'dur' },
  };
  const calls = () => vi.mocked(openmrsFetch).mock.calls.map(([url, init]) => [url, (init as { body: unknown }).body]);

  beforeEach(() =>
    vi
      .mocked(openmrsFetch)
      .mockReset()
      .mockResolvedValue({ data: {} } as never),
  );

  it('adds a new encounter of the update type when the prescription was recorded on an earlier day', async () => {
    const current = currentPrescriptionOf(
      [encounter('e', '2026-06-10T09:00:00.000+0000', [group(oral, '2026-06-10', undefined, 'main')])],
      concepts,
    );

    await savePrescription({ ...common, current, main: 'main', today: '2026-10-25' });

    expect(calls()).toHaveLength(1);
    const [[url, body]] = calls() as [
      [string, { patient: string; encounterType: string; location: string; obs: unknown[] }],
    ];
    expect(url).toBe(`${restBaseUrl}/encounter`);
    expect(body).toMatchObject({ patient: 'patient', encounterType: 'update-type', location: 'gulu' });
    expect(body.obs).toHaveLength(3);
  });

  it("edits today's encounter in place, in one request that voids the old answers and adds the new", async () => {
    const current = currentPrescriptionOf(
      [
        encounter('today', '2026-10-25T09:00:00.000+0000', [
          group(oral, '2026-06-10', undefined, 'main'),
          group(q28, '2026-05-01', '2026-06-01', 'stopped-earlier'),
          { uuid: 'duration-obs', concept: { uuid: concepts.duration }, value: coded('d0', 'Lifetime') },
        ]),
      ],
      concepts,
    );

    await savePrescription({ ...common, current, main: 'main', today: '2026-10-25' });

    expect(calls()).toHaveLength(1);
    const [[url, body]] = calls() as [[string, { obs: Array<{ uuid?: string; voided?: boolean }> }]];
    expect(url).toBe(`${restBaseUrl}/encounter/today`);
    expect(body.obs.filter((one) => one.voided).map((one) => one.uuid)).toEqual(['main', 'duration-obs']);
    expect(body.obs.filter((one) => !one.voided)).toHaveLength(3);
  });

  it("re-adds the carried groups when a switch edits today's encounter in place", async () => {
    const current = currentPrescriptionOf(
      [
        encounter('today', '2026-10-25T09:00:00.000+0000', [
          group(oral, '2025-01-01', undefined, 'old'),
          group(q28, '2026-02-01', undefined, 'main'),
        ]),
      ],
      concepts,
    );

    await savePrescription({ ...common, current, main: 'main', today: '2026-10-25' });

    const [[, body]] = calls() as [[string, { obs: Array<Record<string, unknown>> }]];
    expect(body.obs.filter((one) => one.voided).map((one) => one.uuid)).toEqual(['old', 'main']);
    const added = body.obs.filter((one) => !one.voided && one.concept === concepts.prescription);
    expect(
      added.map((one) => {
        const members = one.groupMembers as Array<{ concept: string; value: unknown }>;
        const of = (concept: string) => members.find((member) => member.concept === concept)?.value;
        return [of(concepts.prescription), of(concepts.dateStarted)];
      }),
    ).toEqual([
      [q28.uuid, '2026-10-25'],
      [q28.uuid, '2026-02-01'],
      [oral.uuid, '2025-01-01'],
    ]);
  });
});
