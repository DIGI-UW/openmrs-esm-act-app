import React from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { openmrsFetch } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import RefreshFlags from './refresh-flags.component';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

describe('Flags and adherence page', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await signInWith(['Task: act.refreshFlags']);
  });

  it('heads the page with the assessment pictogram', async () => {
    mockOpenmrsFetch.mockResolvedValue({ data: { lastRefreshed: null, running: false } } as never);

    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <RefreshFlags />
      </SWRConfig>,
    );

    expect(within(screen.getByTestId('act-page-header')).getByText('Assessment1Pictogram')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Refresh now' })).toBeEnabled();
  });

  it('carries the refresh alone, with no second tile and no run chart request', async () => {
    mockOpenmrsFetch.mockResolvedValue({ data: { lastRefreshed: null, running: false } } as never);

    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <RefreshFlags />
      </SWRConfig>,
    );

    expect(await screen.findByRole('button', { name: 'Refresh now' })).toBeEnabled();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(mockOpenmrsFetch.mock.calls.every(([url]) => !String(url).includes('/runchart'))).toBe(true);
  });
});
