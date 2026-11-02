import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openmrsFetch } from '@openmrs/esm-framework';
import { type RunChartParams, useRunChart } from './run-chart.resource';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>
);

const params: RunChartParams = {
  metric: 'active_registrants',
  clinic: 'clinic-1',
  startDate: '2026-01-01',
  endDate: '2026-03-31',
  points: 'week',
};

const answer = {
  startDate: '2026-01-01',
  endDate: '2026-03-31',
  period: 'week',
  metrics: {
    active_registrants: { points: [{ date: '2026-01-04', value: 9, count: 9, total: null }], median: 9 },
    total_registrants: { points: [{ date: '2026-01-04', value: 12, count: 12, total: null }], median: 12 },
  },
};

describe('useRunChart', () => {
  beforeEach(() => {
    vi.mocked(openmrsFetch).mockReset();
  });

  it('asks ACT Core for every metric over the range in points of the period, for the clinic, and reads its own', async () => {
    vi.mocked(openmrsFetch).mockResolvedValue({ data: answer } as never);

    const { result } = renderHook(() => useRunChart(params), { wrapper });

    await waitFor(() => expect(result.current.points).toHaveLength(1));
    const url = new URL(String(vi.mocked(openmrsFetch).mock.calls[0][0]), 'http://x');
    expect(url.pathname).toBe('/ws/rest/v1/actcore/runchart');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      clinic: 'clinic-1',
      startDate: '2026-01-01',
      endDate: '2026-03-31',
      points: 'week',
    });
    expect(result.current.points[0].value).toBe(9);
    expect(result.current.median).toBe(9);
  });

  it('serves two metrics over one range from one request', async () => {
    vi.mocked(openmrsFetch).mockResolvedValue({ data: answer } as never);

    const { result } = renderHook(
      () => [useRunChart(params), useRunChart({ ...params, metric: 'total_registrants' })],
      { wrapper },
    );

    await waitFor(() => expect(result.current[1].points).toHaveLength(1));
    expect(result.current[0].points[0].value).toBe(9);
    expect(result.current[1].points[0].value).toBe(12);
    expect(openmrsFetch).toHaveBeenCalledTimes(1);
  });

  it('leaves the clinic out to read every clinic', async () => {
    vi.mocked(openmrsFetch).mockResolvedValue({ data: { ...answer, metrics: {} } } as never);

    const { result } = renderHook(() => useRunChart({ ...params, clinic: null }), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(new URL(String(vi.mocked(openmrsFetch).mock.calls[0][0]), 'http://x').searchParams.has('clinic')).toBe(
      false,
    );
    expect(result.current.points).toEqual([]);
  });

  it('asks for nothing without params, and says so when ACT Core cannot answer', async () => {
    const { result: idle } = renderHook(() => useRunChart(null), { wrapper });
    expect(idle.current.isLoading).toBe(false);
    expect(openmrsFetch).not.toHaveBeenCalled();

    vi.mocked(openmrsFetch).mockRejectedValue(new Error('refused'));
    const { result: failing } = renderHook(() => useRunChart(params), { wrapper });
    await waitFor(() => expect(failing.current.error?.message).toBe('refused'));
    expect(failing.current.points).toEqual([]);
  });
});
