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

  it('is null for a patient with no prescription', () => {
    expect(currentPrescriptionOf([encounter('e', '2026-06-10T09:00:00.000+0000', [])], concepts)).toBeNull();
  });
});

describe('prescriptionPayload', () => {
  const patient = 'patient';
  const regimen = (uuid: string) => ({ uuid, label: '' });
  const memberOf = (member: { concept: string; value: unknown }[], concept: string) =>
    member.find((one) => one.concept === concept)?.value;

  it('records the edited prescription and carries every other current one unchanged, with the duration', () => {
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
    expect(groups).toHaveLength(2);
    expect(memberOf(groups[0].groupMembers!, concepts.prescription)).toBe('2f3ee632-dd14-51b0-a4ec-de10e7958019');
    expect(memberOf(groups[0].groupMembers!, concepts.dateStarted)).toBe('2026-10-25');
    expect(memberOf(groups[1].groupMembers!, concepts.prescription)).toBe(oral.uuid);
    expect(memberOf(groups[1].groupMembers!, concepts.dateStarted)).toBe('2026-05-01');
    expect(obsList.find((one) => one.concept === concepts.duration)?.value).toBe('dur');
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
    expect(body.obs).toHaveLength(2);
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
    expect(body.obs.filter((one) => !one.voided)).toHaveLength(2);
  });
});
