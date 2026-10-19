import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { navigate, openmrsFetch, useSession } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import SessionTimeout, { countdown } from './session-timeout.component';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const MINUTE = 60_000;

const passMinutes = async (minutes: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(minutes * MINUTE);
  });
};

const activityInOtherTab = (at: number) =>
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key: 'act-session-last-activity', newValue: String(at) }));
  });

const sharedActivity = () => window.localStorage.getItem('act-session-last-activity');

const sessionRequests = () =>
  mockOpenmrsFetch.mock.calls.filter(([url]) => String(url).endsWith('/ws/rest/v1/session')).length;

describe('SessionTimeout', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 20, 9, 0, 0));
    await signInWith([]);
    mockOpenmrsFetch.mockReset();
    mockOpenmrsFetch.mockResolvedValue({ data: {} } as never);
    vi.mocked(navigate).mockReset();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows nothing while the user is active', async () => {
    render(<SessionTimeout />);

    await passMinutes(20);
    fireEvent.keyDown(document);
    await passMinutes(20);

    expect(screen.queryByTestId('session-timeout')).not.toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('warns three minutes before the thirty-minute idle time, counting down', async () => {
    render(<SessionTimeout />);

    await passMinutes(26);
    expect(screen.queryByTestId('session-timeout')).not.toBeInTheDocument();
    await passMinutes(1);

    expect(screen.getByText('Still there?')).toBeInTheDocument();
    expect(screen.getByText(/signed out in 3:00/)).toBeInTheDocument();
    await passMinutes(1);
    expect(screen.getByText(/signed out in 2:00/)).toBeInTheDocument();
  });

  it('signs the user out when the countdown ends', async () => {
    render(<SessionTimeout />);

    // The warning opens on the tick at 27 minutes and the sign-out on the first tick three minutes after it.
    await passMinutes(30.1);

    expect(navigate).toHaveBeenCalledWith({ to: '${openmrsSpaBase}/logout' });
  });

  it('asks the server for the session and closes when the user chooses to stay signed in', async () => {
    render(<SessionTimeout />);
    await passMinutes(27);
    expect(sessionRequests()).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: 'Stay signed in' }));

    expect(sessionRequests()).toBe(1);
    expect(screen.queryByTestId('session-timeout')).not.toBeInTheDocument();
    expect(sharedActivity()).toBe(String(Date.now()));
    // The idle clock starts again from the choice.
    await passMinutes(26);
    expect(screen.queryByTestId('session-timeout')).not.toBeInTheDocument();
    await passMinutes(1);
    expect(screen.getByText('Still there?')).toBeInTheDocument();
  });

  it('signs out at once from the warning', async () => {
    render(<SessionTimeout />);
    await passMinutes(27);

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(navigate).toHaveBeenCalledWith({ to: '${openmrsSpaBase}/logout' });
  });

  it('keeps the warning up while the user moves the mouse, until they choose', async () => {
    render(<SessionTimeout />);
    await passMinutes(27);

    fireEvent.mouseMove(document);
    await passMinutes(1);

    expect(screen.getByText('Still there?')).toBeInTheDocument();
    expect(sharedActivity()).toBeNull();
  });

  it('tells other tabs when the user is active here', async () => {
    render(<SessionTimeout />);
    await passMinutes(5);

    fireEvent.keyDown(document);

    expect(sharedActivity()).toBe(String(Date.now()));
  });

  it('counts activity in another tab, since signing out ends the session in every tab', async () => {
    render(<SessionTimeout />);
    await passMinutes(20);

    activityInOtherTab(Date.now());
    await passMinutes(10.1);

    expect(screen.queryByTestId('session-timeout')).not.toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('ignores another tab reporting activity older than this one', async () => {
    render(<SessionTimeout />);
    await passMinutes(20);
    fireEvent.keyDown(document);

    activityInOtherTab(Date.now() - 19 * MINUTE);
    await passMinutes(10.1);

    expect(screen.queryByTestId('session-timeout')).not.toBeInTheDocument();
  });

  it('closes the warning when the user is active in another tab', async () => {
    render(<SessionTimeout />);
    await passMinutes(27);

    activityInOtherTab(Date.now());

    expect(screen.queryByTestId('session-timeout')).not.toBeInTheDocument();
    await passMinutes(4);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('tells other tabs when it signs out, and leaves for the login page when another tab signed out', async () => {
    render(<SessionTimeout />);
    await passMinutes(27);

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(window.localStorage.getItem('act-session-signed-out')).toBe(String(Date.now()));

    vi.mocked(navigate).mockReset();
    await act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'act-session-signed-out', newValue: String(Date.now()) }),
      );
    });
    expect(navigate).toHaveBeenCalledWith({ to: '${openmrsSpaBase}/login' });
  });

  it('signs out at once when the timer wakes after the whole idle time, as from a sleeping laptop', async () => {
    render(<SessionTimeout />);

    vi.setSystemTime(Date.now() + 60 * MINUTE);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(navigate).toHaveBeenCalledWith({ to: '${openmrsSpaBase}/logout' });
    expect(screen.queryByTestId('session-timeout')).not.toBeInTheDocument();
  });

  it('keeps the server session alive every ten minutes while the user is active without saving', async () => {
    render(<SessionTimeout />);

    for (let minute = 0; minute < 25; minute++) {
      fireEvent.keyDown(document);
      await passMinutes(1);
    }

    expect(sessionRequests()).toBe(2);
    expect(screen.queryByTestId('session-timeout')).not.toBeInTheDocument();
  });

  it('does not keep an idle session alive', async () => {
    render(<SessionTimeout />);

    await passMinutes(20);

    expect(sessionRequests()).toBe(0);
  });

  it('takes its times from the configuration', async () => {
    await signInWith([], { sessionTimeout: { idleMinutes: 10, warningMinutes: 2, keepAliveMinutes: 5 } });
    render(<SessionTimeout />);

    await passMinutes(8);

    expect(screen.getByText(/signed out in 2:00/)).toBeInTheDocument();
  });

  it('does nothing when switched off with no idle time, or when nobody is signed in', async () => {
    await signInWith([], { sessionTimeout: { idleMinutes: 0, warningMinutes: 3, keepAliveMinutes: 10 } });
    const { unmount } = render(<SessionTimeout />);
    await passMinutes(60);
    expect(screen.queryByTestId('session-timeout')).not.toBeInTheDocument();
    unmount();

    await signInWith([]);
    vi.mocked(useSession).mockReturnValue({ authenticated: false, sessionId: 'session' } as never);
    render(<SessionTimeout />);
    await passMinutes(60);

    expect(screen.queryByTestId('session-timeout')).not.toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('countdown', () => {
  it('formats the time left as minutes and seconds, never below zero', () => {
    expect(countdown(180_000)).toBe('3:00');
    expect(countdown(65_500)).toBe('1:06');
    expect(countdown(0)).toBe('0:00');
    expect(countdown(-5000)).toBe('0:00');
  });
});
