import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { homePrivilege, signInWith } from '../access/sign-in.test-helper';
import AdminNav from './admin-nav.component';

describe('AdminNav', () => {
  beforeEach(() => {
    window.openmrsBase = '/openmrs';
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
  });

  it('offers Users and roles, Clinics, Studies, and Flags and adherence under Admin to a user who may use them all', async () => {
    await signInWith([homePrivilege, 'Edit Users', 'Manage Locations', 'Task: act.refreshFlags']);

    render(<AdminNav />);

    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Users and roles' })).toHaveAttribute(
      'href',
      '/openmrs/admin/users/users.list',
    );
    expect(screen.getByRole('link', { name: 'Clinics' })).toHaveAttribute(
      'href',
      '/openmrs/admin/locations/location.list',
    );
    expect(screen.getByRole('link', { name: 'Studies' })).toHaveAttribute('href', '/openmrs/spa/home/act-studies');
    expect(screen.getByRole('link', { name: 'Flags and adherence' })).toHaveAttribute(
      'href',
      '/openmrs/spa/home/act-refresh-flags',
    );
  });

  it.each([
    { privilege: 'Edit Users', shown: ['Users and roles'], hidden: ['Clinics', 'Studies', 'Flags and adherence'] },
    { privilege: 'Manage Locations', shown: ['Clinics', 'Studies'], hidden: ['Users and roles', 'Flags and adherence'] },
    {
      privilege: 'Task: act.refreshFlags',
      shown: ['Flags and adherence'],
      hidden: ['Users and roles', 'Clinics', 'Studies'],
    },
  ])('offers only $shown to a user holding $privilege', async ({ privilege, shown, hidden }) => {
    await signInWith([homePrivilege, privilege]);

    render(<AdminNav />);

    shown.forEach((name) => expect(screen.getByRole('link', { name })).toBeInTheDocument());
    hidden.forEach((name) => expect(screen.queryByRole('link', { name })).not.toBeInTheDocument());
  });

  it('shows nothing, not even its heading, to a user who may manage neither', async () => {
    await signInWith([homePrivilege]);

    const { container } = render(<AdminNav />);

    expect(container).toBeEmptyDOMElement();
  });
});
