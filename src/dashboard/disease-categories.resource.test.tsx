import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { SWRConfig, useSWRConfig } from 'swr';
import { openmrsFetch } from '@openmrs/esm-framework';
import { useDiseaseCategories } from './disease-categories.resource';

const rhd = { uuid: 'rhd-category', display: 'Rheumatic Heart Disease/Rheumatic Fever' };

describe('useDiseaseCategories', () => {
  it('keeps the answers and reports no error when a later reload fails', async () => {
    vi.mocked(openmrsFetch).mockResolvedValueOnce({ data: { answers: [rhd] } } as never);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
    );
    const { result } = renderHook(() => ({ categories: useDiseaseCategories(), swr: useSWRConfig() }), { wrapper });
    await waitFor(() => expect(result.current.categories.categories).toEqual([rhd]));

    vi.mocked(openmrsFetch).mockRejectedValueOnce(new Error('The server did not answer'));
    await act(() => result.current.categories.retry());

    expect(result.current.categories.categories).toEqual([rhd]);
    expect(result.current.categories.error).toBeUndefined();
  });

  it('reports the error when the first load fails', async () => {
    vi.mocked(openmrsFetch).mockRejectedValueOnce(new Error('Privileges required: Get Concepts'));
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>{children}</SWRConfig>
    );
    const { result } = renderHook(() => useDiseaseCategories(), { wrapper });

    await waitFor(() => expect(result.current.error?.message).toBe('Privileges required: Get Concepts'));
    expect(result.current.categories).toEqual([]);
  });
});
