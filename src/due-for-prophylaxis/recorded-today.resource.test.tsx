import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { openmrsFetch } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { useRecordedToday } from './recorded-today.resource';

const bpgForm = '0119d2e6-e2e1-391c-9b88-d59a10b0780d';
const oralForm = 'ba29e982-ce18-302a-9fc4-d4b2c3983465';
const mockOpenmrsFetch = vi.mocked(openmrsFetch);

// A fresh cache per test, so one test's answer is not another's.
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>
);

const injectionDate = '183fb30e-b861-5b7c-806f-7118a40f2b51';
const dated = [{ concept: { uuid: injectionDate } }];

function encountersByPatient(forms: Record<string, Array<string>>, obs: Array<{ concept: { uuid: string } }> = dated) {
  mockOpenmrsFetch.mockImplementation((url: string) => {
    const patient = new URL(url, 'http://localhost').searchParams.get('patient');
    const results = (forms[patient] ?? []).map((form) => ({ uuid: `${patient}-${form}`, form: { uuid: form }, obs }));
    return Promise.resolve({ data: { results } } as never);
  });
}

describe('useRecordedToday', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 9, 6, 10, 30));
    await signInWith([]);
    mockOpenmrsFetch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("asks for each patient's encounters since this morning, with each encounter's form", async () => {
    encountersByPatient({});

    renderHook(() => useRecordedToday(['patient-a', 'patient-b']), { wrapper });

    await waitFor(() => expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2));
    const queries = mockOpenmrsFetch.mock.calls.map(([url]) => new URL(String(url), 'http://localhost').searchParams);
    expect(queries.map((query) => query.get('patient'))).toEqual(['patient-a', 'patient-b']);
    expect(queries.map((query) => query.get('fromdate'))).toEqual([
      new Date(2026, 9, 6).toISOString(),
      new Date(2026, 9, 6).toISOString(),
    ]);
    expect(queries[0].get('v')).toBe('custom:(uuid,form:(uuid),obs:(concept:(uuid)))');
  });

  it("asks from the clinic's midnight, not UTC's, outside UTC", async () => {
    vi.stubEnv('TZ', 'Africa/Kampala');
    expect(new Date(2026, 9, 6).getTimezoneOffset()).toBe(-180);
    vi.setSystemTime(new Date('2026-10-05T22:00:00.000Z'));
    encountersByPatient({});

    renderHook(() => useRecordedToday(['patient-a']), { wrapper });

    await waitFor(() => expect(mockOpenmrsFetch).toHaveBeenCalled());
    const query = new URL(String(mockOpenmrsFetch.mock.calls[0][0]), 'http://localhost').searchParams;
    expect(query.get('fromdate')).toBe('2026-10-05T21:00:00.000Z');
  });

  it('counts a patient with a BPG or oral prophylaxis encounter dated today, and no one else', async () => {
    encountersByPatient({ 'patient-bpg': [bpgForm], 'patient-oral': [oralForm], 'patient-other': ['another-form'] });

    const { result } = renderHook(
      () => useRecordedToday(['patient-bpg', 'patient-oral', 'patient-other', 'patient-none']),
      {
        wrapper,
      },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect([...result.current.recorded].sort()).toEqual(['patient-bpg', 'patient-oral']);
  });

  it('does not count a BPG visit with no Date of Injection, as the form records none when BPG is withheld', async () => {
    encountersByPatient({ 'patient-withheld': [bpgForm], 'patient-oral': [oralForm] }, []);

    const { result } = renderHook(() => useRecordedToday(['patient-withheld', 'patient-oral']), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect([...result.current.recorded]).toEqual(['patient-oral']);
  });

  it('returns the error when a lookup fails', async () => {
    mockOpenmrsFetch.mockRejectedValue(new Error('timeout'));

    const { result } = renderHook(() => useRecordedToday(['patient-a']), { wrapper });

    await waitFor(() => expect(result.current.error).toEqual(new Error('timeout')));
    expect(result.current.recorded.size).toBe(0);
  });

  it('does not ask again after a failure, as each retry sends every lookup again', async () => {
    mockOpenmrsFetch.mockRejectedValue(new Error('timeout'));

    const { result } = renderHook(() => useRecordedToday(['patient-a', 'patient-b']), { wrapper });

    await waitFor(() => expect(result.current.error).toEqual(new Error('timeout')));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
  });

  it('asks nothing when nobody is listed', () => {
    const { result } = renderHook(() => useRecordedToday([]), { wrapper });

    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
    expect(result.current.recorded.size).toBe(0);
  });
});
