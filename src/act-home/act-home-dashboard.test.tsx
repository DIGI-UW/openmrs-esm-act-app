import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { type AssignedExtension, ExtensionSlot, useAssignedExtensions } from '@openmrs/esm-framework';
import { homePrivilege, signInWith } from '../access/sign-in.test-helper';
import ActHomeDashboard from './act-home-dashboard.component';

const mockUseAssignedExtensions = vi.mocked(useAssignedExtensions);

describe('ActHomeDashboard', () => {
  it('shows the ACT home heading and an empty state while no widget is assigned', async () => {
    await signInWith([homePrivilege]);
    mockUseAssignedExtensions.mockReturnValue([]);

    render(<ActHomeDashboard />);

    expect(screen.getByRole('heading', { name: 'ACT home' })).toBeInTheDocument();
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

  it('tells a user without the ACT home privilege that they cannot see it', async () => {
    await signInWith(['View Patient Flags']);
    mockUseAssignedExtensions.mockReturnValue([{ id: 'widget' } as AssignedExtension]);

    render(<ActHomeDashboard />);

    expect(screen.queryByRole('heading', { name: 'ACT home' })).not.toBeInTheDocument();
    expect(screen.getByText('You do not have access to ACT home.')).toBeInTheDocument();
  });
});
