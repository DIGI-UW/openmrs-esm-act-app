import React from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { getDefaultsFromConfigSchema, openmrsFetch, useConfig } from '@openmrs/esm-framework';
import { type Config, configSchema } from '../config-schema';
import { listsForPatient, type RhdFlagList, useRhdFlagLists } from './rhd-flag-lists.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const mockUseConfig = vi.mocked(useConfig<Config>);

const cohorts = [
  { uuid: 'overdue', name: 'RHD prophylaxis overdue' },
  { uuid: 'inr', name: 'RHD INR target missing' },
  { uuid: 'new', name: 'RHD delivery outcome overdue' },
  { uuid: 'other', name: 'HIV viral load due' },
  { uuid: 'hand-made', name: 'Clinic RHD review' },
  { uuid: 'deleted', name: 'RHD deleted flag', voided: true },
];

const members: Record<string, Array<{ patient: { uuid: string }; voided: boolean }>> = {
  overdue: [
    { patient: { uuid: 'amina' }, voided: false },
    { patient: { uuid: 'peter' }, voided: false },
    { patient: { uuid: 'voided' }, voided: true },
  ],
  inr: [{ patient: { uuid: 'peter' }, voided: false }],
  new: [],
  other: [{ patient: { uuid: 'amina' }, voided: false }],
};

function page<T>(results: Array<T>, url: string, pageSize = 50) {
  const params = new URL(url, 'http://host').searchParams;
  const start = Number(params.get('startIndex'));
  const size = Math.min(pageSize, Number(params.get('limit') ?? pageSize));
  return { results: results.slice(start, start + size), totalCount: results.length };
}

function respond({ pageSize = 50 } = {}) {
  mockOpenmrsFetch.mockImplementation(((url: string) => {
    const params = new URL(url, 'http://host').searchParams;
    if (url.includes('/cohortm/cohortmember')) {
      return Promise.resolve({ data: page(members[params.get('cohort')], url, pageSize) });
    }
    const q = params.get('q').toLowerCase();
    return Promise.resolve({
      data: page(
        cohorts.filter((cohort) => cohort.name.toLowerCase().includes(q)),
        url,
        pageSize,
      ),
    });
  }) as never);
}

function renderLists(cache = new Map(), options: { withMembers?: boolean } = {}) {
  return renderHook(() => useRhdFlagLists(options), {
    wrapper: ({ children }) => <SWRConfig value={{ provider: () => cache, dedupingInterval: 0 }}>{children}</SWRConfig>,
  });
}

function useConfigWith(flagLists: Partial<Config['flagLists']> = {}) {
  const defaults = getDefaultsFromConfigSchema(configSchema) as Config;
  mockUseConfig.mockReturnValue({ ...defaults, flagLists: { ...defaults.flagLists, ...flagLists } });
}

function summary(lists: Array<RhdFlagList>) {
  return lists.map(({ flagName, priority, memberCount, memberUuids, cohortUuid }) => ({
    flagName,
    priority,
    memberCount,
    members: memberUuids && [...memberUuids],
    cohortUuid,
  }));
}

describe('useRhdFlagLists', () => {
  beforeEach(() => useConfigWith());

  it('lists each list whose name has the prefix, with its current members and priority', async () => {
    respond();

    const { result } = renderLists(new Map(), { withMembers: true });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeUndefined();
    expect(summary(result.current.lists)).toEqual([
      {
        flagName: 'RHD prophylaxis overdue',
        priority: 'risk',
        memberCount: 2,
        members: ['amina', 'peter'],
        cohortUuid: 'overdue',
      },
      {
        flagName: 'RHD INR target missing',
        priority: 'dataQuality',
        memberCount: 1,
        members: ['peter'],
        cohortUuid: 'inr',
      },
      {
        flagName: 'RHD delivery outcome overdue',
        priority: 'dataQuality',
        memberCount: 0,
        members: [],
        cohortUuid: 'new',
      },
    ]);
  });

  it('counts each list with one small request when the members are not asked for', async () => {
    respond();

    const { result } = renderLists();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(
      summary(result.current.lists).map(({ flagName, memberCount, members }) => [flagName, memberCount, members]),
    ).toEqual([
      ['RHD prophylaxis overdue', 3, undefined],
      ['RHD INR target missing', 1, undefined],
      ['RHD delivery outcome overdue', 0, undefined],
    ]);
    const memberUrls = mockOpenmrsFetch.mock.calls.map(([url]) => url).filter((url) => url.includes('/cohortm/'));
    expect(memberUrls).toHaveLength(3);
    expect(memberUrls.every((url) => url.includes('limit=1'))).toBe(true);
  });

  it('lists only the configured flags when names is set, with 0 for a flag that has no list yet', async () => {
    useConfigWith({ names: ['HIV viral load due', 'RHD site infection not recorded', 'RHD delivery outcome'] });
    respond();

    const { result } = renderLists();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(
      summary(result.current.lists).map(({ flagName, memberCount, cohortUuid }) => [flagName, memberCount, cohortUuid]),
    ).toEqual([
      ['HIV viral load due', 1, 'other'],
      ['RHD site infection not recorded', 0, null],
      ['RHD delivery outcome', 0, null],
    ]);
  });

  it('reads every page, at the page size the server chooses', async () => {
    respond({ pageSize: 1 });

    const { result } = renderLists(new Map(), { withMembers: true });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(summary(result.current.lists).map(({ flagName, memberCount }) => [flagName, memberCount])).toEqual([
      ['RHD prophylaxis overdue', 2],
      ['RHD INR target missing', 1],
      ['RHD delivery outcome overdue', 0],
    ]);
    expect(mockOpenmrsFetch.mock.calls.some(([url]) => url.includes('limit='))).toBe(false);
    // One page each: 5 cohorts match the search; the lists' member rows take 3, 1 and 1 (an empty list is one page).
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(5 + 3 + 1 + 1);
  });

  it('keeps the lists it has when a screen mounts again', async () => {
    respond();
    const cache = new Map();

    const { result: firstMount, unmount } = renderLists(cache);
    await waitFor(() => expect(firstMount.current.lists).toHaveLength(3));
    const requests = mockOpenmrsFetch.mock.calls.length;
    unmount();
    const { result: secondMount } = renderLists(cache);

    expect(secondMount.current.lists).toHaveLength(3);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(requests);
  });

  it('fetches the members for a screen that asks for them after one that counted', async () => {
    respond();
    const cache = new Map();

    const { result: counted } = renderLists(cache);
    await waitFor(() => expect(counted.current.lists).toHaveLength(3));
    const { result: withMembers } = renderLists(cache, { withMembers: true });

    await waitFor(() => expect(withMembers.current.lists[0]?.memberUuids).toEqual(new Set(['amina', 'peter'])));
  });

  it('stops reading members when a first page is empty though the server reports a total', async () => {
    mockOpenmrsFetch.mockImplementation(((url: string) =>
      Promise.resolve({
        data: url.includes('/cohortm/cohortmember')
          ? { results: [], totalCount: 5 }
          : { results: cohorts.slice(0, 1), totalCount: 1 },
      })) as never);

    const { result } = renderLists(new Map(), { withMembers: true });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(summary(result.current.lists).map(({ memberCount, members }) => [memberCount, members])).toEqual([[0, []]]);
  });

  it('is loading until the lists arrive', () => {
    mockOpenmrsFetch.mockReturnValue(new Promise(() => {}) as never);

    const { result } = renderLists();

    expect(result.current.isLoading).toBe(true);
    expect(result.current.lists).toEqual([]);
  });

  it('reports a failed request', async () => {
    const serverError = Object.assign(new Error('Server responded with 500'), { response: { status: 500 } });
    respond();
    mockOpenmrsFetch.mockImplementation(((url: string) =>
      url.includes('/cohortm/cohortmember')
        ? Promise.reject(serverError)
        : Promise.resolve({ data: { results: cohorts, totalCount: cohorts.length } })) as never);

    const { result } = renderLists();

    await waitFor(() => expect(result.current.error).toBe(serverError));
    expect(result.current.lists).toEqual([]);
  });
});

describe('listsForPatient', () => {
  it('names the lists the patient is on', () => {
    const list = (flagName: string, memberUuids: Array<string>): RhdFlagList => ({
      cohortUuid: flagName,
      flagName,
      priority: 'dataQuality',
      memberCount: memberUuids.length,
      memberUuids: new Set(memberUuids),
    });
    const lists = [list('RHD a', ['amina', 'peter']), list('RHD b', ['peter'])];

    expect(listsForPatient(lists, 'amina').map((l) => l.flagName)).toEqual(['RHD a']);
    expect(listsForPatient(lists, 'nobody')).toEqual([]);
  });
});
