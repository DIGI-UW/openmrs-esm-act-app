import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getConfig, getDefaultsFromConfigSchema, getGlobalStore, openmrsFetch } from '@openmrs/esm-framework';
import { type Config, configSchema } from '../config-schema';
import { type ChartEncounter, representation } from '../consultations/consultations.resource';
import {
  allergiesHelper,
  allergiesOf,
  allergiesText,
  currentAllergiesControl,
  fetchAllergiesText,
  registerAllergies,
} from './allergies.resource';

vi.mock('@openmrs/esm-framework', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@openmrs/esm-framework')>()),
  getConfig: vi.fn(),
}));

const config = getDefaultsFromConfigSchema(configSchema) as Config;
const c = config.consultations.concepts;
const [penicillinAllergy, penicillinAnaphylaxis] = config.consultations.penicillinAllergyAnswers;
const coded = (uuid: string, display: string) => ({ uuid, display });
const obs = (concept: string, value: unknown, groupMembers?: Array<unknown>) => ({
  concept: { uuid: concept },
  value,
  groupMembers,
});
const a = config.allergies.concepts;
const allergy = (answer: object, added?: string, { reactions = [] as Array<string>, resolved = '' } = {}) =>
  obs(c.allergy, null, [
    obs(c.allergy, answer),
    ...(reactions.length
      ? [
          obs(
            a.reaction,
            null,
            reactions.map((name) => obs(a.reaction, coded(name, name))),
          ),
        ]
      : []),
    ...(added ? [obs(c.dateAdded, added)] : []),
    ...(resolved ? [obs(a.dateResolved, resolved)] : []),
  ]);
const consultation = (uuid: string, date: string, obsList: Array<unknown> = []): ChartEncounter =>
  ({ uuid, encounterDatetime: `${date}T09:00:00.000+0300`, encounterProviders: [], obs: obsList }) as ChartEncounter;

const penicillin = coded(penicillinAllergy, 'Penicillin (allergy)');
const other = coded('5622AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'Other');

describe('allergiesOf', () => {
  it('flags the two penicillin answers the patients report counts, and no other', () => {
    const found = allergiesOf(
      [
        consultation('one', '2026-04-01', [
          allergy(penicillin),
          allergy(coded(penicillinAnaphylaxis, 'Penicillin (anaphylaxis)')),
          allergy(other),
        ]),
      ],
      [],
      config,
    ).current;

    expect(found.map((one) => [one.name, one.isPenicillin])).toEqual(
      expect.arrayContaining([
        ['Penicillin (allergy)', true],
        ['Penicillin (anaphylaxis)', true],
        ['Other', false],
      ]),
    );
    expect(found).toHaveLength(3);
  });

  it('flags an answer named penicillin whatever its uuid', () => {
    const found = allergiesOf(
      [consultation('one', '2026-04-01', [allergy(coded('another-concept', 'Allergy to penicillin'))])],
      [],
      config,
    ).current;

    expect(found.map((one) => one.isPenicillin)).toEqual([true]);
  });

  it("lists every consultation's allergies once, so one an old consultation recorded stays until that is edited", () => {
    const found = allergiesOf(
      [
        consultation('new', '2026-04-01', [allergy(other)]),
        consultation('old', '2025-10-01', [allergy(penicillin), allergy(other)]),
      ],
      [],
      config,
    ).current;

    expect(found.map((one) => one.name).sort()).toEqual(['Other', 'Penicillin (allergy)']);
  });

  it('has none for a patient whose consultations record no allergy', () => {
    expect(allergiesOf([consultation('one', '2026-04-01')], [], config)).toEqual({ current: [], past: [] });
    expect(allergiesOf([], [], config)).toEqual({ current: [], past: [] });
  });

  it('lets the latest record of an allergy decide: a Date Resolved on RHD Allergies moves it to past', () => {
    const { current, past } = allergiesOf(
      [consultation('visit', '2025-10-01', [allergy(penicillin, '2025-10-01'), allergy(other)])],
      [consultation('resolved', '2026-03-05', [allergy(penicillin, '2025-10-01', { resolved: '2026-03-01' })])],
      config,
    );

    expect(current.map((one) => one.name)).toEqual(['Other']);
    expect(past).toHaveLength(1);
    expect(past[0]).toMatchObject({
      name: 'Penicillin (allergy)',
      resolved: '2026-03-01',
      added: '2025-10-01',
      encounterUuid: 'resolved',
      form: config.allergies.form,
    });
  });

  it('makes a resolved allergy current again when a later record has no Date Resolved', () => {
    const { current, past } = allergiesOf(
      [],
      [
        consultation('again', '2026-05-01', [allergy(penicillin, '2026-05-01')]),
        consultation('resolved', '2026-03-05', [allergy(penicillin, '2025-10-01', { resolved: '2026-03-01' })]),
      ],
      config,
    );

    expect(past).toEqual([]);
    expect(current).toHaveLength(1);
    expect(current[0]).toMatchObject({ resolved: null, added: '2025-10-01', encounterUuid: 'again' });
  });

  it('lets a resolved record decide over another of the same allergy saved at the same time, in either order', () => {
    const open = consultation('open', '2026-03-05', [allergy(penicillin, '2026-03-05')]);
    const resolved = consultation('resolved', '2026-03-05', [
      allergy(penicillin, '2026-03-05', { resolved: '2026-03-05' }),
    ]);

    for (const records of [
      [open, resolved],
      [resolved, open],
    ]) {
      const { current, past } = allergiesOf([], records, config);
      expect(current).toEqual([]);
      expect(past.map((one) => one.encounterUuid)).toEqual(['resolved']);
    }
  });

  it("reads each allergy's reactions and the form of the record that decides it", () => {
    const { current } = allergiesOf(
      [consultation('visit', '2025-10-01', [allergy(other)])],
      [
        consultation('record', '2026-03-05', [
          allergy(penicillin, '2026-03-05', { reactions: ['Anaphylaxis', 'Wheezing'] }),
        ]),
      ],
      config,
    );

    expect(current.map((one) => [one.name, one.reactions, one.form, one.encounterUuid])).toEqual([
      ['Penicillin (allergy)', ['Anaphylaxis', 'Wheezing'], config.allergies.form, 'record'],
      ['Other', [], config.consultations.form, 'visit'],
    ]);
  });
});

describe('allergiesText', () => {
  const list = (names: Array<[string, boolean]>) =>
    names.map(([name, isPenicillin]) => ({ key: name, name, added: '', isPenicillin }));

  it('leads with the penicillin warning, in capitals, when any allergy is to penicillin', () => {
    expect(
      allergiesText(
        list([
          ['Other', false],
          ['Penicillin (allergy)', true],
        ]),
      ),
    ).toBe('PENICILLIN ALLERGY: Penicillin (allergy), Other');
  });

  it('lists the other allergies without the warning', () => {
    expect(allergiesText(list([['Other', false]]))).toBe('Allergies: Other');
  });

  it('says no allergy is recorded, not that there is none, when no consultation lists one', () => {
    expect(allergiesText([])).toBe('Allergies not recorded');
  });
});

describe('fetchAllergiesText', () => {
  beforeEach(() => {
    vi.mocked(getConfig).mockResolvedValue(config as never);
  });

  const serve = (encounters: Array<ChartEncounter>) =>
    vi
      .mocked(openmrsFetch)
      .mockResolvedValue({ data: { results: encounters, totalCount: encounters.length } } as never);

  it("reads the patient's consultations and RHD Allergies with the app's own config", async () => {
    serve([consultation('one', '2026-04-01', [allergy(penicillin)])]);

    expect(await fetchAllergiesText('abebe')).toBe('PENICILLIN ALLERGY: Penicillin (allergy)');
    expect(getConfig).toHaveBeenCalledWith('@act-registry/esm-act-app');
    const urls = vi.mocked(openmrsFetch).mock.calls.map(([url]) => String(url));
    expect(urls.filter((url) => url.includes(`&v=${representation}`))).toHaveLength(2);
    expect(urls).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`/encounter?patient=abebe&encounterType=${config.consultations.encounterType}`),
        expect.stringContaining(`/encounter?patient=abebe&encounterType=${config.allergies.encounterType}`),
      ]),
    );
  });

  it('leaves out a resolved allergy', async () => {
    serve([consultation('one', '2026-04-01', [allergy(penicillin, '2026-01-01', { resolved: '2026-03-01' })])]);

    expect(await fetchAllergiesText('abebe')).toBe('Allergies not recorded');
  });

  it('says allergies are not recorded for a patient with no consultation', async () => {
    serve([]);

    expect(await fetchAllergiesText('abebe')).toBe('Allergies not recorded');
  });

  it('never reads a failed fetch, a failed config or a missing patient as none', async () => {
    vi.mocked(openmrsFetch).mockRejectedValue(new Error('403'));
    expect(await fetchAllergiesText('abebe')).toBe('Allergies unavailable');

    serve([]);
    vi.mocked(getConfig).mockRejectedValue(new Error('no config'));
    expect(await fetchAllergiesText('abebe')).toBe('Allergies unavailable');

    vi.mocked(getConfig).mockResolvedValue(config as never);
    expect(await fetchAllergiesText('')).toBe('Allergies unavailable');
  });
});

describe('registerAllergies', () => {
  it("adds the helper and the control to the form engine's registry, keeping what is already there", async () => {
    getGlobalStore<Record<string, unknown>>('forms-engine-store', {
      controls: [{ name: 'other-control' }],
      expressionHelpers: { other: 1 },
    } as never);

    registerAllergies();

    const registry = getGlobalStore<{
      expressionHelpers: Record<string, unknown>;
      controls: Array<{ name: string; type?: string; load?: () => Promise<{ default: unknown }> }>;
    }>('forms-engine-store').getState();
    expect(registry.expressionHelpers[allergiesHelper]).toBe(fetchAllergiesText);
    expect(registry.expressionHelpers.other).toBe(1);
    expect(allergiesHelper).toBe('actAllergies');
    expect(registry.controls.map((one) => one.name)).toEqual(['other-control', currentAllergiesControl]);
    expect(currentAllergiesControl).toBe('act-current-allergies');
    const control = registry.controls.find((one) => one.name === currentAllergiesControl);
    expect(control.type).toBe(currentAllergiesControl);
    expect(typeof (await control.load()).default).toBe('function');
  });

  it('registers the control once however often the app starts', () => {
    getGlobalStore<Record<string, unknown>>('forms-engine-store').setState({ controls: [], expressionHelpers: {} });

    registerAllergies();
    registerAllergies();

    const { controls } = getGlobalStore<{ controls: Array<{ name: string }> }>('forms-engine-store').getState();
    expect(controls.filter((one) => one.name === currentAllergiesControl)).toHaveLength(1);
  });
});
