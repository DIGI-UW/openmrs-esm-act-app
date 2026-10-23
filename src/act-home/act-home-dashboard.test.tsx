import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { type AssignedExtension, ExtensionSlot, useAssignedExtensions, useSession } from '@openmrs/esm-framework';
import { homePrivilege, signInWith } from '../access/sign-in.test-helper';
import ActHomeDashboard from './act-home-dashboard.component';

const mockUseAssignedExtensions = vi.mocked(useAssignedExtensions);

function withRoles(...roles: Array<string>) {
  const signedIn = vi.mocked(useSession)();
  vi.mocked(useSession).mockReturnValue({
    ...signedIn,
    user: { ...signedIn.user, roles: roles.map((display) => ({ uuid: display, display })) },
  } as never);
}

const header = () => within(screen.getByTestId('act-page-header'));

describe('ActHomeDashboard', () => {
  it('shows the ACT home header and an empty state while no widget is assigned', async () => {
    await signInWith([homePrivilege]);
    mockUseAssignedExtensions.mockReturnValue([]);

    render(<ActHomeDashboard />);

    expect(within(screen.getByTestId('act-page-header')).getByText('ACT home')).toBeInTheDocument();
    expect(screen.getByText('No widgets have been added to ACT home yet.')).toBeInTheDocument();
  });

  it('renders the widget slot, and no empty state, once a widget is assigned', async () => {
    await signInWith([homePrivilege]);
    mockUseAssignedExtensions.mockReturnValue([{ id: 'widget' } as AssignedExtension]);

    render(<ActHomeDashboard />);

    expect(screen.queryByText('No widgets have been added to ACT home yet.')).not.toBeInTheDocument();
    expect(mockUseAssignedExtensions).toHaveBeenCalledWith('rhd-home-widgets-slot');
    expect(vi.mocked(ExtensionSlot).mock.calls[0][0]).toEqual(
      expect.objectContaining({ name: 'rhd-home-widgets-slot' }),
    );
  });

  it('shows the ACT logo beside the title instead of a hospital pictogram', async () => {
    await signInWith([homePrivilege]);
    mockUseAssignedExtensions.mockReturnValue([]);

    render(<ActHomeDashboard />);

    expect(header().getByRole('img', { name: 'ACT logo' })).toBeInTheDocument();
    expect(header().queryByText('HomePictogram')).not.toBeInTheDocument();
  });

  it.each([
    ['Organizational: ACT Clinician', 'Clinician'],
    ['Organizational: ACT Community Clinician', 'Community Clinician'],
    ['Organizational: ACT Data Clerk', 'Data Clerk'],
    ['Organizational: ACT Site Administrator', 'Site Administrator'],
    ['Organizational: ACT Instance Administrator', 'Instance Administrator'],
    ['Organizational: ACT Global Administrator', 'Global Administrator'],
  ])("shows the signed-in user's %s role as %s", async (role, shown) => {
    await signInWith([homePrivilege]);
    withRoles(role, 'Provider');
    mockUseAssignedExtensions.mockReturnValue([]);

    render(<ActHomeDashboard />);

    expect(header().getByText(`Role: ${shown}`)).toBeInTheDocument();
  });

  it('names every ACT role the user holds, and none of the server roles beside them', async () => {
    await signInWith([homePrivilege]);
    withRoles('Organizational: ACT Clinician', 'Organizational: ACT Data Clerk', 'System Developer');
    mockUseAssignedExtensions.mockReturnValue([]);

    render(<ActHomeDashboard />);

    expect(header().getByText('Role: Clinician, Data Clerk')).toBeInTheDocument();
  });

  it('shows no role to a user with no ACT role', async () => {
    await signInWith([homePrivilege]);
    withRoles('System Developer');
    mockUseAssignedExtensions.mockReturnValue([]);

    render(<ActHomeDashboard />);

    expect(header().queryByText(/Role:/)).not.toBeInTheDocument();
  });
});
