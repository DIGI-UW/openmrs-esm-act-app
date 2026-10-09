import React from 'react';
import { SWRConfig } from 'swr';
import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { openmrsFetch } from '@openmrs/esm-framework';
import { useRhdFlagList } from './rhd-flag-lists.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const cohorts = [
  { uuid: 'lost', name: 'RHD lost to follow-up', voided: false },
  { uuid: 'lost-old', name: 'RHD lost to follow-up (old)', voided: false },
  { uuid: 'deleted', name: 'RHD deleted flag', voided: true },
];

/** The cohort search matches names containing the text; a list's members are counted from totalCount. */
function respond(memberCounts: Record<string, number> = { lost: 4 }) {
  mockOpenmrsFetch.mockImplementation(((url: string) => {
    const params = new URL(url, 'http://host').searchParams;
    if (url.includes('/cohortm/cohortmember')) {
      return Promise.resolve({ data: { results: [], totalCount: memberCounts[params.get('cohort')] ?? 0 } });
    }
    const q = params.get('q').toLowerCase();
    const results = cohorts.filter((cohort) => cohort.name.toLowerCase().includes(q));
    return Promise.resolve({ data: { results, totalCount: results.length } });
  }) as never);
}

function renderList(flagName: string) {
  return renderHook(() => useRhdFlagList(flagName), {
    wrapper: ({ children }) => (
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
    ),
  });
}

describe('useRhdFlagList', () => {
  it('finds the list named exactly as the flag, and counts its patients in one small request', async () => {
    respond();

    const { result } = renderList('RHD lost to follow-up');

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.list).toEqual({ cohortUuid: 'lost', memberCount: 4 });
    const memberUrls = mockOpenmrsFetch.mock.calls.map(([url]) => url).filter((url) => url.includes('/cohortm/'));
    expect(memberUrls).toEqual([expect.stringContaining('limit=1')]);
  });

  it('has no list for a flag without one, or whose list was voided', async () => {
    respond();

    const { result: missing } = renderList('RHD INR review due');
    const { result: voided } = renderList('RHD deleted flag');

    await waitFor(() => expect(missing.current.isLoading).toBe(false));
    await waitFor(() => expect(voided.current.isLoading).toBe(false));
    expect(missing.current.list).toBeNull();
    expect(voided.current.list).toBeNull();
  });

  it('reports a failed request', async () => {
    const serverError = new Error('Server responded with 500');
    mockOpenmrsFetch.mockRejectedValue(serverError);

    const { result } = renderList('RHD lost to follow-up');

    await waitFor(() => expect(result.current.error).toBe(serverError));
    expect(result.current.list).toBeNull();
  });
});
