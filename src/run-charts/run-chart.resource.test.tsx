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

describe('useRunChart', () => {
  beforeEach(() => {
    vi.mocked(openmrsFetch).mockReset();
  });

  it('asks ACT Core for the metric over the range in points of the period, for the clinic', async () => {
    vi.mocked(openmrsFetch).mockResolvedValue({
      data: {
        metric: 'active_registrants',
        points: [{ date: '2025-12-29', value: 9, count: 9, total: null }],
        median: 9,
        lastSnapshot: '2026-03-30',
      },
    } as never);

    const { result } = renderHook(() => useRunChart(params), { wrapper });

    await waitFor(() => expect(result.current.points).toHaveLength(1));
    const url = new URL(String(vi.mocked(openmrsFetch).mock.calls[0][0]), 'http://x');
    expect(url.pathname).toBe('/ws/rest/v1/actcore/runchart');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      metric: 'active_registrants',
      clinic: 'clinic-1',
      startDate: '2026-01-01',
      endDate: '2026-03-31',
      points: 'week',
    });
    expect(result.current.median).toBe(9);
    expect(result.current.lastSnapshot).toBe('2026-03-30');
  });

  it('leaves the clinic out to read every clinic', async () => {
    vi.mocked(openmrsFetch).mockResolvedValue({
      data: { metric: 'x', points: [], median: null, lastSnapshot: null },
    } as never);

    const { result } = renderHook(() => useRunChart({ ...params, clinic: null }), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(new URL(String(vi.mocked(openmrsFetch).mock.calls[0][0]), 'http://x').searchParams.has('clinic')).toBe(
      false,
    );
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
