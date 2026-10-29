import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getConfig, getDefaultsFromConfigSchema, getGlobalStore, openmrsFetch } from '@openmrs/esm-framework';
import { type Config, configSchema } from '../config-schema';
import { type ChartEncounter } from '../consultations/consultations.resource';
import {
  allergiesHelper,
  allergiesOf,
  allergiesText,
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
const allergy = (answer: object, added?: string) =>
  obs(c.allergy, null, [obs(c.allergy, answer), ...(added ? [obs(c.dateAdded, added)] : [])]);
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
      config.consultations,
    );

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
      config.consultations,
    );

    expect(found.map((one) => one.isPenicillin)).toEqual([true]);
  });

  it("lists every consultation's allergies once, so one an old consultation recorded stays until that is edited", () => {
    const found = allergiesOf(
      [
        consultation('new', '2026-04-01', [allergy(other)]),
        consultation('old', '2025-10-01', [allergy(penicillin), allergy(other)]),
      ],
      config.consultations,
    );

    expect(found.map((one) => one.name).sort()).toEqual(['Other', 'Penicillin (allergy)']);
  });

  it('has none for a patient whose consultations record no allergy', () => {
    expect(allergiesOf([consultation('one', '2026-04-01')], config.consultations)).toEqual([]);
    expect(allergiesOf([], config.consultations)).toEqual([]);
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

  it("reads the patient's consultations with the app's own config", async () => {
    serve([consultation('one', '2026-04-01', [allergy(penicillin)])]);

    expect(await fetchAllergiesText('abebe')).toBe('PENICILLIN ALLERGY: Penicillin (allergy)');
    expect(getConfig).toHaveBeenCalledWith('@act-registry/esm-act-app');
    expect(vi.mocked(openmrsFetch).mock.calls[0][0]).toContain(
      `/encounter?patient=abebe&encounterType=${config.consultations.encounterType}`,
    );
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
  it("adds the helper to the form engine's registry, keeping the helpers and lists already there", () => {
    getGlobalStore<Record<string, unknown>>('forms-engine-store', {
      controls: [],
      expressionHelpers: { other: 1 },
    } as never);

    registerAllergies();

    const registry = getGlobalStore<{ expressionHelpers: Record<string, unknown> }>('forms-engine-store').getState();
    expect(registry.expressionHelpers[allergiesHelper]).toBe(fetchAllergiesText);
    expect(registry.expressionHelpers.other).toBe(1);
    expect(allergiesHelper).toBe('actAllergies');
  });
});
