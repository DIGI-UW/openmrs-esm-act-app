import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { type AssignedExtension, ExtensionSlot, useAssignedExtensions } from '@openmrs/esm-framework';
import { dataClerkPrivilege, signInWith } from '../access/sign-in.test-helper';
import DataClerkDashboard from './data-clerk-dashboard.component';

const mockUseAssignedExtensions = vi.mocked(useAssignedExtensions);

describe('DataClerkDashboard', () => {
  it('shows the data clerk header and an empty state while no widget is assigned', async () => {
    await signInWith([dataClerkPrivilege]);
    mockUseAssignedExtensions.mockReturnValue([]);

    render(<DataClerkDashboard />);

    expect(within(screen.getByTestId('act-page-header')).getByText('Data clerk')).toBeInTheDocument();
    expect(screen.getByText('No widgets have been added to the data clerk workspace yet.')).toBeInTheDocument();
  });

  it('renders the widget slot, and no empty state, once a widget is assigned', async () => {
    await signInWith([dataClerkPrivilege]);
    mockUseAssignedExtensions.mockReturnValue([{ id: 'widget' } as AssignedExtension]);

    render(<DataClerkDashboard />);

    expect(screen.queryByText('No widgets have been added to the data clerk workspace yet.')).not.toBeInTheDocument();
    expect(mockUseAssignedExtensions).toHaveBeenCalledWith('rhd-data-clerk-widgets-slot');
    expect(vi.mocked(ExtensionSlot).mock.calls[0][0]).toEqual(
      expect.objectContaining({ name: 'rhd-data-clerk-widgets-slot' }),
    );
  });

  it('tells a user without the data clerk privilege that they cannot see it', async () => {
    await signInWith(['View Patient Flags']);
    mockUseAssignedExtensions.mockReturnValue([{ id: 'widget' } as AssignedExtension]);

    render(<DataClerkDashboard />);

    expect(screen.queryByTestId('act-page-header')).not.toBeInTheDocument();
    expect(screen.getByText('You do not have access to the data clerk workspace.')).toBeInTheDocument();
  });
});
