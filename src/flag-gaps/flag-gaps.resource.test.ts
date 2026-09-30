import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { openmrsFetch } from '@openmrs/esm-framework';
import { usePatientFlagGaps } from './flag-gaps.resource';

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
