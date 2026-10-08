import React from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { formatDatetime, openmrsFetch, showSnackbar } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import RefreshFlags from './refresh-flags.component';
import { type RefreshStatus } from './refresh-flags.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const earlier = '2026-10-07T20:37:04Z';
const now = '2026-10-08T07:30:00Z';
const serverError =
  'Server responded with 500 (Internal Server Error) for url /ws/rest/v1/actcore/refresh. Check err.responseBody or network tab in dev tools for more info';

function backendAnswers(status: RefreshStatus, refresh: () => Promise<RefreshStatus>) {
  mockOpenmrsFetch.mockImplementation(async (url: string, init?: { method?: string }) => {
    expect(url).toMatch(/\/ws\/rest\/v1\/actcore\/refresh$/);
    return { data: init?.method === 'POST' ? await refresh() : status } as never;
  });
}

function renderPage() {
  // A fresh cache per test, so one test's status never answers another's.
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <RefreshFlags />
    </SWRConfig>,
  );
}

describe('Flags and adherence', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await signInWith(['Task: act.refreshFlags']);
  });

  it('says when the refresh last finished', async () => {
    backendAnswers({ lastRefreshed: earlier, running: false }, vi.fn());

    renderPage();

    expect(await screen.findByText(`Last refreshed ${formatDatetime(new Date(earlier))}`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh now' })).toBeEnabled();
  });

  it('says so when no refresh has finished yet', async () => {
    backendAnswers({ lastRefreshed: null, running: false }, vi.fn());

    renderPage();

    expect(await screen.findByText('Not refreshed yet')).toBeInTheDocument();
  });

  it('runs the refresh, then shows its finish time and confirms it', async () => {
    const refresh = vi.fn().mockResolvedValue({ lastRefreshed: now, running: false, refreshed: true });
    backendAnswers({ lastRefreshed: earlier, running: false }, refresh);
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Refresh now' }));

    expect(await screen.findByText(`Last refreshed ${formatDatetime(new Date(now))}`)).toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(showSnackbar).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'success', title: 'Flags and adherence refreshed' }),
    );
  });

  it('cannot start another refresh while its own is in flight', async () => {
    let finish: (status: RefreshStatus) => void;
    backendAnswers(
      { lastRefreshed: earlier, running: false },
      () => new Promise<RefreshStatus>((resolve) => (finish = resolve)),
    );
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Refresh now' }));

    expect(await screen.findByRole('button', { name: /Refreshing/ })).toBeDisabled();
    finish({ lastRefreshed: now, running: false, refreshed: true });
    expect(await screen.findByRole('button', { name: 'Refresh now' })).toBeEnabled();
  });

  it('tells the user when another refresh was already running', async () => {
    backendAnswers({ lastRefreshed: earlier, running: false }, async () => ({
      lastRefreshed: earlier,
      running: true,
      refreshed: false,
    }));
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Refresh now' }));

    await waitFor(() =>
      expect(showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'info', title: 'A refresh is already running' }),
      ),
    );
  });

  it('reports a failed refresh and lets the user try again', async () => {
    backendAnswers({ lastRefreshed: earlier, running: false }, async () => {
      throw Object.assign(new Error(serverError), {
        responseBody: { error: { message: 'The patient flag refresh failed' } },
      });
    });
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Refresh now' }));

    await waitFor(() =>
      expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error', subtitle: serverError })),
    );
    expect(screen.getByRole('button', { name: 'Refresh now' })).toBeEnabled();
  });

  it('cannot start a refresh while one is running', async () => {
    backendAnswers({ lastRefreshed: earlier, running: true }, vi.fn());

    renderPage();

    await screen.findByText(`Last refreshed ${formatDatetime(new Date(earlier))}`);
    expect(screen.getByRole('button', { name: 'Refresh now' })).toBeDisabled();
  });

  it('shows the running refresh once it finishes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      backendAnswers({ lastRefreshed: earlier, running: true }, vi.fn());
      renderPage();
      await screen.findByText(`Last refreshed ${formatDatetime(new Date(earlier))}`);

      backendAnswers({ lastRefreshed: now, running: false }, vi.fn());
      await vi.advanceTimersByTimeAsync(5000);

      expect(await screen.findByText(`Last refreshed ${formatDatetime(new Date(now))}`)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Refresh now' })).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });
});
