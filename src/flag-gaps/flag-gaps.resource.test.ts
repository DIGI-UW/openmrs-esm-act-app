import React from 'react';
import { SWRConfig, useSWRConfig } from 'swr';
import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { openmrsFetch } from '@openmrs/esm-framework';
import { useNextSteps } from '../next-steps/next-steps.resource';
import { dismissFlag, usePatientFlagGaps, useRaisedFlags } from './flag-gaps.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const gap = {
  encounter: 'encounter-1',
  encounterDatetime: '2026-09-10T09:00:00.000+0000',
  form: { uuid: 'form-uuid', display: 'Procedures and Outcomes' },
  concept: { uuid: 'perfusion-uuid', display: 'Perfusion Issues' },
};

function respondWith(byUrl: (url: string) => unknown) {
  mockOpenmrsFetch.mockImplementation((url: string) => Promise.resolve({ data: byUrl(url) }) as never);
}

describe('usePatientFlagGaps', () => {
  it('looks up the gaps behind each flag the patient has raised now, each once', async () => {
    respondWith((url) =>
      url.includes('/patientflags/patientflag')
        ? {
            results: [
              { voided: false, flag: { uuid: 'perfusion', display: 'RHD perfusion issues not recorded' } },
              { voided: false, flag: { uuid: 'perfusion', display: 'RHD perfusion issues not recorded' } },
              { voided: true, flag: { uuid: 'cleared', display: 'RHD site infection not recorded' } },
            ],
          }
        : { configured: true, results: [gap] },
    );

    const { result } = renderHook(() => usePatientFlagGaps('patient-uuid'));

    await waitFor(() => expect(result.current.flagGaps).toHaveLength(1));
    expect(result.current.flagGaps[0]).toEqual({
      flagUuid: 'perfusion',
      flagName: 'RHD perfusion issues not recorded',
      configured: true,
      gaps: [gap],
    });
    const gapUrls = mockOpenmrsFetch.mock.calls.map(([url]) => url).filter((url) => url.includes('/actcore/gap'));
    expect(gapUrls).toEqual([expect.stringContaining('patient=patient-uuid&flag=perfusion')]);
  });

  it('looks up only the clicked flag when it is given', async () => {
    mockOpenmrsFetch.mockClear();
    respondWith(() => ({ configured: false, results: [] }));

    const { result } = renderHook(() => usePatientFlagGaps('patient-2', { uuid: 'death', name: 'RHD death' }));

    await waitFor(() => expect(result.current.flagGaps).toHaveLength(1));
    expect(result.current.flagGaps[0]).toMatchObject({ flagUuid: 'death', flagName: 'RHD death', configured: false });
    const urls = mockOpenmrsFetch.mock.calls.map(([url]) => url);
    expect(urls.some((url) => url.includes('/patientflags/patientflag'))).toBe(false);
  });
});

describe('useRaisedFlags', () => {
  it("reads the patient's raised flags from ACT Core", async () => {
    const raised = {
      flag: 'perfusion',
      display: 'RHD perfusion',
      raisedSince: '2026-09-05T08:00:00.000+0000',
      dismissible: true,
    };
    respondWith(() => ({ results: [raised] }));

    const { result } = renderHook(() => useRaisedFlags('patient-3'));

    await waitFor(() => expect(result.current.raisedFlags).toEqual([raised]));
    expect(mockOpenmrsFetch).toHaveBeenCalledWith(expect.stringContaining('/actcore/raisedflags?patient=patient-3'));
  });
});

describe('dismissFlag', () => {
  it('asks ACT Core to dismiss the flag for the patient, then reloads their flags and Next steps', async () => {
    mockOpenmrsFetch.mockClear();
    respondWith((url) =>
      url.includes('/patientflags/patientflag')
        ? { results: [{ voided: false, flag: { uuid: 'perfusion', display: 'RHD perfusion' } }] }
        : { configured: true, results: [] },
    );
    // A cache given through a provider, as O3 gives every extension, which swr's global mutate does not reach.
    const cache = new Map();
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(SWRConfig, { value: { provider: () => cache } }, children);
    const { result } = renderHook(
      () => ({
        gaps: usePatientFlagGaps('patient-4'),
        steps: useNextSteps('patient-4'),
        mutate: useSWRConfig().mutate,
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.gaps.flagGaps).toHaveLength(1));
    const fetchesBefore = mockOpenmrsFetch.mock.calls.length;

    await dismissFlag('patient-4', 'perfusion', result.current.mutate);

    expect(mockOpenmrsFetch).toHaveBeenCalledWith(
      expect.stringContaining('/actcore/raisedflags/dismiss'),
      expect.objectContaining({ method: 'POST', body: { patient: 'patient-4', flag: 'perfusion' } }),
    );
    await waitFor(() =>
      expect(
        mockOpenmrsFetch.mock.calls
          .slice(fetchesBefore)
          .some(([url]) => String(url).includes('/patientflags/patientflag?patient=patient-4')),
      ).toBe(true),
    );
    await waitFor(() =>
      expect(
        mockOpenmrsFetch.mock.calls
          .slice(fetchesBefore)
          .some(([url]) => String(url).includes('/actcore/nextsteps?patient=patient-4')),
      ).toBe(true),
    );
  });
});
