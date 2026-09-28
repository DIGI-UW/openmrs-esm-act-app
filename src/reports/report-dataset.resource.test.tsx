import React from 'react';
import { SWRConfig } from 'swr';
import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { openmrsFetch } from '@openmrs/esm-framework';
import routes from '../routes.json';
import { useReportDataset } from './report-dataset.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const waitingListUuid = '5b0f1c2e-9d3a-4c1b-8f6e-2a7d9e4b3c10';
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

function renderDataset(report: string | null, params?: Record<string, string>) {
  return renderHook(() => useReportDataset(report, params), {
    wrapper: ({ children }) => (
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
    ),
  });
}

describe('useReportDataset', () => {
  it("evaluates the report with its parameters and returns the dataset's columns and rows", async () => {
    respond(() => evaluated(rows));

    const { result } = renderDataset(waitingListUuid, { startDate: '2026-01-01', clinic: 'Kitgum & Lira' });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toMatchObject({ columns, rows, error: undefined });
    const [url] = mockOpenmrsFetch.mock.calls.map(([url]) => url);
    expect(url).toContain(`/reportingrest/reportdata/${waitingListUuid}?`);
    expect(new URL(url, 'http://host').searchParams.get('clinic')).toBe('Kitgum & Lira');
    expect(new URL(url, 'http://host').searchParams.get('startDate')).toBe('2026-01-01');
  });

  it('finds a report by its exact name among the reports whose names contain it', async () => {
    respond((url) =>
      url.includes('/reportDefinition')
        ? {
            results: [
              { uuid: 'other-uuid', name: 'Procedural Waiting List (archived)' },
              { uuid: waitingListUuid, name: 'Procedural Waiting List' },
            ],
          }
        : evaluated(rows),
    );

    const { result } = renderDataset('Procedural Waiting List');

    await waitFor(() => expect(result.current.rows).toEqual(rows));
    const urls = mockOpenmrsFetch.mock.calls.map(([url]) => url);
    expect(urls[0]).toContain('/reportingrest/reportDefinition?q=Procedural%20Waiting%20List');
    expect(urls[1]).toContain(`/reportingrest/reportdata/${waitingListUuid}`);
  });

  it('finds the exact name on a later page of the search', async () => {
    const hits = [
      ...Array.from({ length: 50 }, (_, i) => ({ uuid: `archived-${i}`, name: `Procedural Waiting List ${i}` })),
      { uuid: waitingListUuid, name: 'Procedural Waiting List' },
    ];
    respond((url) => {
      if (!url.includes('/reportDefinition')) {
        return evaluated(rows);
      }
      const start = Number(new URL(url, 'http://host').searchParams.get('startIndex'));
      return { results: hits.slice(start, start + 50), totalCount: hits.length };
    });

    const { result } = renderDataset('Procedural Waiting List');

    await waitFor(() => expect(result.current.rows).toEqual(rows));
  });

  it('says so when no report has the name', async () => {
    respond(() => ({ results: [{ uuid: 'other-uuid', name: 'Procedural Waiting List (archived)' }] }));

    const { result } = renderDataset('Procedural Waiting List');

    await waitFor(() => expect(result.current.error?.message).toBe('No report is named "Procedural Waiting List"'));
    expect(mockOpenmrsFetch.mock.calls.some(([url]) => url.includes('/reportdata/'))).toBe(false);
  });

  it('returns no columns and no rows for an empty dataset, as the server sends none', async () => {
    respond(() => evaluated([], []));

    const { result } = renderDataset(waitingListUuid);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current).toMatchObject({ columns: [], rows: [], error: undefined });
  });

  it('returns the server error', async () => {
    const serverError = Object.assign(new Error('Server responded with 500'), { response: { status: 500 } });
    respond(() => serverError);

    const { result } = renderDataset(waitingListUuid, { startDate: '2026-01-01' });

    await waitFor(() => expect(result.current.error).toBe(serverError));
    expect(result.current).toMatchObject({ columns: [], rows: [], isLoading: false });
  });

  it('does not evaluate a failing report again', async () => {
    const serverError = Object.assign(new Error('Server responded with 500'), { response: { status: 500 } });
    respond(() => serverError);

    const { result } = renderHook(() => useReportDataset(waitingListUuid, { startDate: '' }), {
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
        useReportDataset(waitingListUuid, { startDate: '2026-01-01', endDate: '2026-12-31' }),
        useReportDataset(waitingListUuid, { endDate: '2026-12-31', startDate: '2026-01-01' }),
      ],
      { wrapper: ({ children }) => <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig> },
    );

    await waitFor(() => expect(result.current.every((dataset) => dataset.rows.length === 1)).toBe(true));
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
  });

  it('evaluates the report again when its parameters change', async () => {
    respond(() => evaluated(rows));

    const { result, rerender } = renderHook(({ params }) => useReportDataset(waitingListUuid, params), {
      initialProps: { params: { startDate: '2026-01-01' } },
      wrapper: ({ children }) => <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>,
    });
    await waitFor(() => expect(result.current.rows).toEqual(rows));
    rerender({ params: { startDate: '2026-06-01' } });

    await waitFor(() => expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2));
    expect(new URL(mockOpenmrsFetch.mock.calls[1][0], 'http://host').searchParams.get('startDate')).toBe('2026-06-01');
  });

  it('fetches nothing without a report', () => {
    const { result } = renderDataset(null);

    expect(result.current).toMatchObject({ columns: [], rows: [], isLoading: false });
    expect(mockOpenmrsFetch).not.toHaveBeenCalled();
  });
});

describe('routes.json', () => {
  it('declares the reporting REST module the reports are evaluated through', () => {
    expect(routes.backendDependencies).toHaveProperty('reportingrest');
  });
});
