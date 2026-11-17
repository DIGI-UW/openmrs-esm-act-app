import { describe, expect, it, vi } from 'vitest';
import { getGlobalStore, openmrsFetch } from '@openmrs/esm-framework';
import { nextInjectionDue, nextInjectionDueHelper, registerNextInjectionDue } from './next-injection-due';

const summary = (type: 'BPG' | 'Oral' | null, intervalDays: number | null) =>
  vi.mocked(openmrsFetch).mockResolvedValue({ data: { type, intervalDays } } as never);

describe('nextInjectionDue', () => {
  it('adds the prescription interval ACT Core reads to the Date of Injection', async () => {
    summary('BPG', 21);

    const due = await nextInjectionDue('grace', new Date(2026, 9, 14));

    expect(due).toEqual(new Date(2026, 10, 4));
    expect(openmrsFetch).toHaveBeenCalledWith('/ws/rest/v1/actcore/prophylaxis?patient=grace');
  });

  it('has none for an oral regimen, no prescription, or a summary that cannot be read', async () => {
    summary('Oral', 0);
    expect(await nextInjectionDue('grace', new Date(2026, 9, 14))).toBeNull();

    summary(null, null);
    expect(await nextInjectionDue('grace', new Date(2026, 9, 14))).toBeNull();

    vi.mocked(openmrsFetch).mockRejectedValue(new Error('403'));
    expect(await nextInjectionDue('grace', new Date(2026, 9, 14))).toBeNull();
  });

  it('asks nothing before a Date of Injection is entered', async () => {
    vi.mocked(openmrsFetch).mockClear();

    expect(await nextInjectionDue('grace', '')).toBeNull();
    expect(openmrsFetch).not.toHaveBeenCalled();
  });
});

describe('registerNextInjectionDue', () => {
  it("adds the helper to the form engine's registry, which keeps its other lists", () => {
    registerNextInjectionDue();

    const registry = getGlobalStore<Record<string, unknown>>('forms-engine-store').getState();
    expect(registry.expressionHelpers).toEqual({ [nextInjectionDueHelper]: nextInjectionDue });
    expect(registry.controls).toEqual([]);
    expect(registry.formSchemaTransformers).toEqual([]);
  });
});
