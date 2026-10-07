import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { type AssignedExtension, ExtensionSlot, useAssignedExtensions, useSession } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import CommunityHomeDashboard from './community-home-dashboard.component';
import { CommunityHomeQuickActions } from '../quick-actions/quick-actions.component';

const mockUseAssignedExtensions = vi.mocked(useAssignedExtensions);

function session() {
  vi.mocked(useSession).mockReturnValue({
    authenticated: true,
    sessionId: 'session',
    user: { uuid: 'clinician', privileges: [], roles: [] },
    sessionLocation: { uuid: 'clinic', display: 'Kiswa Health Centre III' },
  } as never);
}

describe('Community home', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 8, 28, 10, 0));
    await signInWith(['App: act.communityHome']);
    session();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is headed Home, with the session's location and today's date", () => {
    mockUseAssignedExtensions.mockReturnValue([{ id: 'widget' } as AssignedExtension]);

    render(<CommunityHomeDashboard />);

    const header = screen.getByTestId('act-page-header');
    expect(within(header).getByRole('heading', { level: 1 })).toHaveTextContent('Home');
    expect(within(header).getByText('Kiswa Health Centre III')).toBeInTheDocument();
    expect(within(header).getByText('28-Sept-2026')).toBeInTheDocument();
  });

  it('says so while no widget is assigned to Home', () => {
    mockUseAssignedExtensions.mockReturnValue([]);

    render(<CommunityHomeDashboard />);

    expect(screen.getByText('No widgets have been added to Home yet.')).toBeInTheDocument();
  });

  it("renders the widgets assigned to Home's own slot", () => {
    mockUseAssignedExtensions.mockReturnValue([{ id: 'widget' } as AssignedExtension]);

    render(<CommunityHomeDashboard />);

    expect(mockUseAssignedExtensions).toHaveBeenCalledWith('act-community-home-widgets-slot');
    expect(vi.mocked(ExtensionSlot).mock.lastCall[0]).toEqual(
      expect.objectContaining({ name: 'act-community-home-widgets-slot' }),
    );
  });

  it('frames the quick action tiles, which come from their own slot', () => {
    render(<CommunityHomeQuickActions />);

    expect(screen.getByRole('heading', { name: 'Quick actions' })).toBeInTheDocument();
    expect(vi.mocked(ExtensionSlot).mock.lastCall[0]).toEqual(
      expect.objectContaining({ name: 'act-community-home-quick-actions-slot' }),
    );
  });
});
