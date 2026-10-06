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

function encountersByPatient(forms: Record<string, Array<string>>) {
  mockOpenmrsFetch.mockImplementation((url: string) => {
    const patient = new URL(url, 'http://localhost').searchParams.get('patient');
    const results = (forms[patient] ?? []).map((form) => ({ uuid: `${patient}-${form}`, form: { uuid: form } }));
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
    expect(queries[0].get('v')).toBe('custom:(uuid,form:(uuid))');
  });

  it('counts a patient with a BPG or oral prophylaxis form saved today, and no one else', async () => {
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

  it('asks nothing when nobody is listed', () => {
    const { result } = renderHook(() => useRecordedToday([]), { wrapper });

    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
    expect(result.current.recorded.size).toBe(0);
  });
});
