import React from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { openmrsFetch } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import RefreshFlags from './refresh-flags.component';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

describe('Flags and adherence page', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await signInWith(['Task: act.refreshFlags']);
  });

  it('carries the run chart snapshot beside the refresh, each with its button', async () => {
    mockOpenmrsFetch.mockImplementation(
      async (url: string) =>
        ({
          data: url.includes('/runchart/runs')
            ? { running: false, runs: [], lastTaken: null }
            : { lastRefreshed: null, running: false },
        }) as never,
    );

    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <RefreshFlags />
      </SWRConfig>,
    );

    expect(await screen.findByRole('heading', { name: 'Run chart snapshot' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Take snapshot now' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Refresh now' })).toBeEnabled();
  });
});
