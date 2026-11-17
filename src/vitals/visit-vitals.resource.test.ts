import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getConfig, getDefaultsFromConfigSchema, getGlobalStore, openmrsFetch } from '@openmrs/esm-framework';
import { type Config, configSchema } from '../config-schema';
import {
  fetchVisitVitalsText,
  registerVisitVitals,
  type VisitObs,
  visitVitalsHelper,
  vitalsNotRecorded,
  vitalsText,
} from './visit-vitals.resource';

vi.mock('@openmrs/esm-framework', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@openmrs/esm-framework')>()),
  getConfig: vi.fn(),
}));

const config = getDefaultsFromConfigSchema(configSchema) as Config;
const vitals = config.consultations.vitals;
const systolic = '5085AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const diastolic = '5086AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const pulse = '5087AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const weight = '5089AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const obs = (concept: string, value: unknown, time = '09:00', voided = false): VisitObs => ({
  concept: { uuid: concept },
  value,
  obsDatetime: `2026-10-29T${time}:00.000+0300`,
  voided,
});

describe('vitalsText', () => {
  it('shows the recorded vitals in the configured order, blood pressure as one', () => {
    expect(vitalsText([obs(weight, 42), obs(pulse, 88), obs(diastolic, 70), obs(systolic, 110)], vitals)).toBe(
      'Vitals at this visit: BP 110/70 mmHg, Pulse 88 bpm, Weight 42 kg',
    );
  });

  it('shows the latest of a vital recorded twice, and never a voided one', () => {
    expect(
      vitalsText([obs(pulse, 120, '08:00'), obs(pulse, 90, '10:00'), obs(weight, 99, '11:00', true)], vitals),
    ).toBe('Vitals at this visit: Pulse 90 bpm');
  });

  it('marks the half of a blood pressure not recorded', () => {
    expect(vitalsText([obs(systolic, 110)], vitals)).toBe('Vitals at this visit: BP 110/– mmHg');
  });

  it('says vitals are not recorded when the visit has none, whatever else it records', () => {
    expect(vitalsText([], vitals)).toBe(vitalsNotRecorded);
    expect(vitalsText([obs('other-concept', 1)], vitals)).toBe(vitalsNotRecorded);
  });
});

describe('fetchVisitVitalsText', () => {
  beforeEach(() => {
    vi.mocked(getConfig).mockResolvedValue(config as never);
  });

  const serve = (encounters: Array<{ voided?: boolean; obs: Array<VisitObs> }>) =>
    vi.mocked(openmrsFetch).mockResolvedValue({ data: { encounters } } as never);

  it("reads the visit's encounters, skipping a voided one", async () => {
    serve([{ obs: [obs(pulse, 88)] }, { voided: true, obs: [obs(weight, 42)] }]);

    expect(await fetchVisitVitalsText('abebe', 'today')).toBe('Vitals at this visit: Pulse 88 bpm');
    expect(getConfig).toHaveBeenCalledWith('@act-registry/esm-act-app');
    expect(vi.mocked(openmrsFetch).mock.calls[0][0]).toContain('/visit/today?v=custom:');
  });

  it('says vitals are not recorded for a consultation outside a visit, without asking the server', async () => {
    vi.mocked(openmrsFetch).mockClear();

    expect(await fetchVisitVitalsText('abebe', undefined)).toBe(vitalsNotRecorded);
    expect(openmrsFetch).not.toHaveBeenCalled();
  });

  it('never reads a failed fetch, a failed config or a missing patient as none', async () => {
    vi.mocked(openmrsFetch).mockRejectedValue(new Error('403'));
    expect(await fetchVisitVitalsText('abebe', 'today')).toBe('Vitals unavailable');

    serve([]);
    vi.mocked(getConfig).mockRejectedValue(new Error('no config'));
    expect(await fetchVisitVitalsText('abebe', 'today')).toBe('Vitals unavailable');

    vi.mocked(getConfig).mockResolvedValue(config as never);
    expect(await fetchVisitVitalsText('', 'today')).toBe('Vitals unavailable');
  });
});

describe('registerVisitVitals', () => {
  it("adds the helper to the form engine's registry, keeping the helpers already there", () => {
    getGlobalStore<Record<string, unknown>>('forms-engine-store', {
      controls: [],
      expressionHelpers: { other: 1 },
    } as never);

    registerVisitVitals();

    const registry = getGlobalStore<{ expressionHelpers: Record<string, unknown> }>('forms-engine-store').getState();
    expect(registry.expressionHelpers[visitVitalsHelper]).toBe(fetchVisitVitalsText);
    expect(registry.expressionHelpers.other).toBe(1);
    expect(visitVitalsHelper).toBe('actVisitVitals');
  });
});
