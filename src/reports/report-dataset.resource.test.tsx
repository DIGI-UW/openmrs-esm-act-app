import React from 'react';
import { SWRConfig } from 'swr';
import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { openmrsFetch } from '@openmrs/esm-framework';
import routes from '../routes.json';
import { type ActList, useReportDataset } from './report-dataset.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const waitingListUuid = '5b0f1c2e-9d3a-4c1b-8f6e-2a7d9e4b3c10';
const waitingList = 'waitingList';
const columns = [
  { name: 'patient_uuid', label: 'Patient', datatype: 'java.lang.String' },
  { name: 'urgency', label: 'Urgency', datatype: 'java.lang.String' },
];
const rows = [{ patient_uuid: 'amina', urgency: '2: Urgent' }];

function evaluated(datasetRows: Array<Record<string, unknown>>, datasetColumns = columns) {
  return { uuid: waitingListUuid, dataSets: [{ metadata: { columns: datasetColumns }, rows: datasetRows }] };
}

function respond(byUrl: (url: string) => unknown) {
  mockOpenmrsFetch.mockImplementation(((url: string) => {
    const data = byUrl(url);
    return data instanceof Error ? Promise.reject(data) : Promise.resolve({ data });
  }) as never);
}

function renderDataset(report: ActList | null, params?: Record<string, string>, cache = new Map()) {
  return renderHook(() => useReportDataset(report, params), {
    wrapper: ({ children }) => <SWRConfig value={{ provider: () => cache, dedupingInterval: 0 }}>{children}</SWRConfig>,
  });
}

describe('useReportDataset', () => {
  it("evaluates the list through ACT Core with its parameters and returns the dataset's columns and rows", async () => {
    respond(() => evaluated(rows));

    const { result } = renderDataset(waitingList, { startDate: '2026-01-01', clinic: 'Kitgum & Lira' });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toMatchObject({ columns, rows, error: undefined });
    const [url] = mockOpenmrsFetch.mock.calls.map(([url]) => url);
    expect(url).toContain('/actcore/list/waitingList?');
    expect(new URL(url, 'http://host').searchParams.get('clinic')).toBe('Kitgum & Lira');
    expect(new URL(url, 'http://host').searchParams.get('startDate')).toBe('2026-01-01');
  });

  it('returns no columns and no rows for an empty dataset, as the server sends none', async () => {
    respond(() => evaluated([], []));

    const { result } = renderDataset(waitingList);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toMatchObject({ columns: [], rows: [], error: undefined });
  });

  it('returns the server error', async () => {
    const serverError = Object.assign(new Error('Server responded with 500'), { response: { status: 500 } });
    respond(() => serverError);

    const { result } = renderDataset(waitingList, { startDate: '2026-01-01' });

    await waitFor(() => expect(result.current.error).toBe(serverError));
    expect(result.current).toMatchObject({ columns: [], rows: [], isLoading: false });
  });

  it('does not evaluate a failing report again', async () => {
    const serverError = Object.assign(new Error('Server responded with 500'), { response: { status: 500 } });
    respond(() => serverError);

    const { result } = renderHook(() => useReportDataset(waitingList, { startDate: '' }), {
      wrapper: ({ children }) => (
        <SWRConfig value={{ provider: () => new Map(), errorRetryInterval: 1, errorRetryCount: 3 }}>
          {children}
        </SWRConfig>
      ),
    });

    await waitFor(() => expect(result.current.error).toBe(serverError));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
  });

  it('evaluates the report once for the same parameters given in another order', async () => {
    respond(() => evaluated(rows));

    const { result } = renderHook(
      () => [
        useReportDataset(waitingList, { startDate: '2026-01-01', endDate: '2026-12-31' }),
        useReportDataset(waitingList, { endDate: '2026-12-31', startDate: '2026-01-01' }),
      ],
      { wrapper: ({ children }) => <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig> },
    );

    await waitFor(() => expect(result.current.every((dataset) => dataset.rows.length === 1)).toBe(true));
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
  });

  it('evaluates the report again when its parameters change', async () => {
    respond(() => evaluated(rows));

    const { result, rerender } = renderHook(({ params }) => useReportDataset(waitingList, params), {
      initialProps: { params: { startDate: '2026-01-01' } },
      wrapper: ({ children }) => <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>,
    });
    await waitFor(() => expect(result.current.rows).toEqual(rows));
    rerender({ params: { startDate: '2026-06-01' } });

    await waitFor(() => expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2));
    expect(new URL(mockOpenmrsFetch.mock.calls[1][0], 'http://host').searchParams.get('startDate')).toBe('2026-06-01');
  });

  it('shows the cached rows when a screen mounts again, then evaluates the report again', async () => {
    respond(() => evaluated(rows));
    const cache = new Map();
    const { result: firstMount, unmount } = renderDataset(waitingList, {}, cache);
    await waitFor(() => expect(firstMount.current.rows).toEqual(rows));
    unmount();
    const updatedRows = [{ patient_uuid: 'amina', urgency: '1: Emergency' }];
    respond(() => evaluated(updatedRows));

    const { result: secondMount } = renderDataset(waitingList, {}, cache);

    expect(secondMount.current).toMatchObject({ rows, isLoading: false });
    await waitFor(() => expect(secondMount.current.rows).toEqual(updatedRows));
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
  });

  it('fetches nothing without a report', () => {
    const { result } = renderDataset(null);

    expect(result.current).toMatchObject({ columns: [], rows: [], isLoading: false });
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });
});

describe('routes.json', () => {
  it('declares ACT Core, which serves the lists, and not reportingrest, which the lists no longer call', () => {
    expect(routes.backendDependencies).toHaveProperty('actcore');
    expect(routes.backendDependencies).not.toHaveProperty('reportingrest');
  });
});
