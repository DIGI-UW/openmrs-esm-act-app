import React from 'react';
import { SWRConfig, useSWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { getDefaultsFromConfigSchema, openmrsFetch, usePatient } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { type Config, configSchema } from '../config-schema';
import { type ChartEncounter } from '../consultations/consultations.resource';
import CurrentAllergies from './current-allergies.control';

const config = getDefaultsFromConfigSchema(configSchema) as Config;
const c = config.consultations.concepts;
const coded = (uuid: string, display: string) => ({ uuid, display });
const obs = (concept: string, value: unknown, groupMembers?: Array<unknown>) => ({
  concept: { uuid: concept },
  value,
  groupMembers,
});
const allergy = (answer: object) => obs(c.allergy, null, [obs(c.allergy, answer)]);
const encounter = (uuid: string, obsList: Array<unknown>): ChartEncounter =>
  ({ uuid, encounterDatetime: '2026-10-12T09:00:00.000+0300', encounterProviders: [], obs: obsList }) as ChartEncounter;
const penicillin = coded(config.consultations.penicillinAllergyAnswers[0], 'Penicillin (allergy)');

let records: Array<ChartEncounter> = [];
const field = { id: 'current_allergies', label: 'Current allergies', questionOptions: {} } as never;
let revalidate: () => Promise<unknown>;

function Revalidator() {
  const { mutate } = useSWRConfig();
  revalidate = () => mutate(() => true);
  return null;
}

const mountControl = (value: string, setFieldValue = vi.fn()) => {
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <Revalidator />
      <CurrentAllergies field={field} value={value} setFieldValue={setFieldValue} />
    </SWRConfig>,
  );
  return setFieldValue;
};

describe('the consultation form’s Current allergies', () => {
  beforeEach(async () => {
    records = [];
    await signInWith(['Get Encounters', 'Get Observations']);
    vi.mocked(usePatient).mockReturnValue({
      patientUuid: 'mary',
      patient: null,
      isLoading: false,
      error: null,
    } as never);
    vi.mocked(openmrsFetch).mockImplementation((async (url: string) =>
      url.includes(`encounterType=${config.allergies.encounterType}`)
        ? { data: { results: records, totalCount: records.length } }
        : { data: { results: [], totalCount: 0 } }) as never);
  });

  it('shows the line the form calculated when it opened, and leaves the form untouched while it agrees', async () => {
    const setFieldValue = mountControl('Allergies not recorded');

    expect(screen.getByLabelText('Current allergies')).toHaveValue('Allergies not recorded');
    await waitFor(() => expect(openmrsFetch).toHaveBeenCalled());
    await act(() => revalidate());
    expect(setFieldValue).not.toHaveBeenCalled();
  });

  it('leaves the form untouched on its first read, even when that differs from the line the form calculated', async () => {
    const setFieldValue = mountControl('Allergies: Other');

    await waitFor(() => expect(openmrsFetch).toHaveBeenCalled());
    await act(() => revalidate());
    expect(setFieldValue).not.toHaveBeenCalled();
  });

  it('keeps the line it read when a later refresh fails, so the penicillin warning stays', async () => {
    records = [encounter('saved', [allergy(penicillin)])];
    const setFieldValue = mountControl('PENICILLIN ALLERGY: Penicillin (allergy)');
    await waitFor(() => expect(openmrsFetch).toHaveBeenCalled());

    vi.mocked(openmrsFetch).mockRejectedValue(new Error('offline'));
    await act(() => revalidate());

    expect(setFieldValue).not.toHaveBeenCalled();
  });

  it('tells the form when an allergy is recorded while the consultation is open', async () => {
    const setFieldValue = mountControl('Allergies not recorded');
    await waitFor(() => expect(openmrsFetch).toHaveBeenCalled());

    records = [encounter('saved', [allergy(penicillin)])];
    await act(() => revalidate());

    await waitFor(() => expect(setFieldValue).toHaveBeenCalledWith('PENICILLIN ALLERGY: Penicillin (allergy)'));
    expect(setFieldValue).toHaveBeenCalledTimes(1);
  });
});
