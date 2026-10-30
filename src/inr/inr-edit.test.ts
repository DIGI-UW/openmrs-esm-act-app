import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDefaultsFromConfigSchema, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { type Config, configSchema } from '../config-schema';
import { type ChartEncounter } from '../consultations/consultations.resource';
import { inrPayload, latestInrEntry, saveInr } from './inr-edit.resource';

const config = getDefaultsFromConfigSchema(configSchema) as Config;
const i = config.inrReviews.concepts;
const { yes, no, targets } = config.inrReviews.answers;
const t23 = targets.find((one) => one.label === '2.0-3.0')!.uuid;
const t35 = targets.find((one) => one.label === '2.5-3.5')!.uuid;
const coded = (uuid: string, display: string) => ({ uuid, display });
const obs = (uuid: string, concept: string, value: unknown, groupMembers?: Array<unknown>) => ({
  uuid,
  concept: { uuid: concept },
  value,
  groupMembers,
});

interface Group {
  uuid: string;
  tested?: string;
  inr?: number;
  dose?: string;
  newDose?: string;
}
function inrEncounter(
  uuid: string,
  datetime: string,
  { groups = [] as Array<Group>, target = '', next = '' } = {},
): ChartEncounter {
  return {
    uuid,
    encounterDatetime: datetime,
    obs: [
      ...(target ? [obs(`${uuid}-target`, i.target, coded(target, 'target'))] : []),
      ...groups.map((group) =>
        obs(group.uuid, i.group, null, [
          ...(group.tested ? [obs(`${group.uuid}-date`, i.dateTested, group.tested)] : []),
          ...(group.inr === undefined ? [] : [obs(`${group.uuid}-inr`, i.value, group.inr)]),
          ...(group.dose ? [obs(`${group.uuid}-dose`, i.doseChange, coded(group.dose, 'dose'))] : []),
          ...(group.newDose ? [obs(`${group.uuid}-new`, i.newDose, group.newDose)] : []),
        ]),
      ),
      ...(next ? [obs(`${uuid}-next`, i.nextInr, next)] : []),
    ],
  } as ChartEncounter;
}

const edit = { dateTested: '2026-10-20', inr: 2.8, doseChange: no, newDose: '', target: t23, nextInr: '2026-11-17' };

describe('latestInrEntry', () => {
  it('is the group with the newest Date Tested among those with an INR, in its own encounter, though a newer encounter is empty', () => {
    const entry = latestInrEntry(
      [
        inrEncounter('empty', '2026-10-29T09:00:00.000+0300'),
        inrEncounter('older', '2026-10-22T09:00:00.000+0300', {
          groups: [
            { uuid: 'g-old', tested: '2026-07-01T00:00:00.000+0300', inr: 1.8 },
            { uuid: 'g-new', tested: '2026-10-16T00:00:00.000+0300', inr: 2.9, dose: no },
          ],
          target: t23,
          next: '2026-11-13T00:00:00.000+0300',
        }),
      ],
      i,
    );

    expect(entry).toMatchObject({
      encounterUuid: 'older',
      groupCount: 2,
      group: { uuid: 'g-new' },
      inr: 2.9,
      target: { obsUuid: 'older-target', valueUuid: t23 },
      next: { obsUuid: 'older-next' },
    });
    expect(entry?.dateTested).toBe('2026-10-16');
  });

  it('skips a group holding no INR, though its Date Tested is newer', () => {
    const entry = latestInrEntry(
      [
        inrEncounter('enc', '2026-10-01T09:00:00.000+0300', {
          groups: [
            { uuid: 'g-inr', tested: '2026-09-01T00:00:00.000+0300', inr: 2.1 },
            { uuid: 'g-none', tested: '2026-10-20T00:00:00.000+0300' },
          ],
        }),
      ],
      i,
    );

    expect(entry).toMatchObject({ group: { uuid: 'g-inr' }, inr: 2.1 });
  });

  it('still chooses a group holding an INR that follows one holding none in the same encounter', () => {
    const entry = latestInrEntry(
      [
        inrEncounter('enc', '2026-10-01T09:00:00.000+0300', {
          groups: [{ uuid: 'g-none' }, { uuid: 'g-inr', tested: '2026-09-01T00:00:00.000+0300', inr: 2.1 }],
        }),
      ],
      i,
    );

    expect(entry).toMatchObject({ group: { uuid: 'g-inr' }, groupCount: 2 });
  });

  it('dates a group with no Date Tested by its encounter', () => {
    const entry = latestInrEntry(
      [inrEncounter('one', '2026-10-12T09:00:00.000+0300', { groups: [{ uuid: 'g', inr: 3.1 }] })],
      i,
    );

    expect(entry?.dateTested).toBe('2026-10-12');
  });

  it('is the newest INR Monitoring encounter when none holds an INR, and nothing without one', () => {
    const entry = latestInrEntry(
      [
        inrEncounter('older', '2026-08-01T09:00:00.000+0300'),
        inrEncounter('newer', '2026-10-01T09:00:00.000+0300', { target: t35 }),
      ],
      i,
    );

    expect(entry).toMatchObject({ encounterUuid: 'newer', group: null, groupCount: 0, inr: null });
    expect(latestInrEntry([], i)).toBeNull();
  });
});

describe('inrPayload', () => {
  const sole = latestInrEntry(
    [
      inrEncounter('enc', '2026-10-16T09:00:00.000+0300', {
        groups: [{ uuid: 'g', tested: '2026-10-16T00:00:00.000+0300', inr: 1.7, dose: yes, newDose: '4 mg' }],
        target: t35,
        next: '2026-11-13T00:00:00.000+0300',
      }),
    ],
    i,
  )!;

  const added = (obsList: Array<any>) => obsList.filter((one) => !one.voided);
  const members = (group: any) => Object.fromEntries(group.groupMembers.map((m: any) => [m.concept, m.value]));

  it('voids the old group, target and next INR and adds the whole new group, target and next INR', () => {
    const body = inrPayload('grace', i, sole, edit);

    expect(body.filter((one: any) => one.voided).map((one: any) => one.uuid)).toEqual(['g', 'enc-target', 'enc-next']);
    const [group, ...rest] = added(body);
    expect(group.concept).toBe(i.group);
    expect(members(group)).toEqual({ [i.dateTested]: '2026-10-20', [i.value]: 2.8, [i.doseChange]: no });
    expect(rest.map((one: any) => [one.concept, one.value])).toEqual([
      [i.target, t23],
      [i.nextInr, '2026-11-17'],
    ]);
  });

  it('carries the new dose only when the dose changed', () => {
    const [group] = added(inrPayload('grace', i, sole, { ...edit, doseChange: yes, newDose: '5 mg' }));

    expect(members(group)).toMatchObject({ [i.doseChange]: yes, [i.newDose]: '5 mg' });
  });

  it('leaves the target and the next INR alone when they are unchanged', () => {
    const body = inrPayload('grace', i, sole, { ...edit, target: t35, nextInr: '2026-11-13' });

    expect(body.filter((one: any) => one.voided).map((one: any) => one.uuid)).toEqual(['g']);
    expect(added(body)).toHaveLength(1);
  });

  it('voids the next INR when it is cleared', () => {
    const body = inrPayload('grace', i, sole, { ...edit, target: t35, nextInr: '' });

    expect(body.filter((one: any) => one.voided).map((one: any) => one.uuid)).toEqual(['g', 'enc-next']);
    expect(added(body)).toHaveLength(1);
  });

  it("never touches the target or the next INR that the encounter's other groups share", () => {
    const shared = latestInrEntry(
      [
        inrEncounter('enc', '2026-10-16T09:00:00.000+0300', {
          groups: [
            { uuid: 'g-old', tested: '2026-07-01T00:00:00.000+0300', inr: 1.8 },
            { uuid: 'g', tested: '2026-10-16T00:00:00.000+0300', inr: 1.7 },
          ],
          target: t35,
          next: '2026-11-13T00:00:00.000+0300',
        }),
      ],
      i,
    )!;

    const body = inrPayload('grace', i, shared, edit);

    expect(body.filter((one: any) => one.voided).map((one: any) => one.uuid)).toEqual(['g']);
    expect(added(body).map((one: any) => one.concept)).toEqual([i.group]);
  });

  it('adds a group to an INR Monitoring that has none, without voiding anything', () => {
    const empty = latestInrEntry([inrEncounter('empty', '2026-10-29T09:00:00.000+0300')], i)!;

    const body = inrPayload('grace', i, empty, edit);

    expect(body.filter((one: any) => one.voided)).toEqual([]);
    expect(added(body).map((one: any) => one.concept)).toEqual([i.group, i.target, i.nextInr]);
  });
});

describe('saveInr', () => {
  beforeEach(() => vi.mocked(openmrsFetch).mockResolvedValue({ data: {} } as never));
  const calls = () => vi.mocked(openmrsFetch).mock.calls as Array<[string, { method: string; body: any }]>;
  const entry = latestInrEntry(
    [
      inrEncounter('enc', '2026-10-16T09:00:00.000+0300', {
        groups: [{ uuid: 'g', tested: '2026-10-16T00:00:00.000+0300', inr: 1.7 }],
      }),
    ],
    i,
  );

  it('edits the encounter in place in one request that names no visit, location or date', async () => {
    await saveInr({ patient: 'grace', encounterType: 'type', location: 'gulu', concepts: i, entry, edit });

    expect(calls()).toHaveLength(1);
    const [[url, init]] = calls();
    expect(url).toBe(`${restBaseUrl}/encounter/enc`);
    expect(init.method).toBe('POST');
    expect(Object.keys(init.body)).toEqual(['obs']);
  });

  it('records a new INR Monitoring at the location, naming no visit or date, so the server places it', async () => {
    await saveInr({ patient: 'grace', encounterType: 'type', location: 'gulu', concepts: i, entry: null, edit });

    const [[url, init]] = calls();
    expect(url).toBe(`${restBaseUrl}/encounter`);
    expect(Object.keys(init.body).sort()).toEqual(['encounterType', 'location', 'obs', 'patient']);
    expect(init.body.obs[0].concept).toBe(i.group);
  });
});
