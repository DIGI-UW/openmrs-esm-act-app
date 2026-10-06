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

  it('offers Users and roles, and Clinics, under Admin to a user who may manage both', async () => {
    await signInWith([homePrivilege, 'Edit Users', 'Manage Locations']);

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
  });

  it.each([
    { privilege: 'Edit Users', shown: 'Users and roles', hidden: 'Clinics' },
    { privilege: 'Manage Locations', shown: 'Clinics', hidden: 'Users and roles' },
  ])('offers only $shown to a user holding $privilege', async ({ privilege, shown, hidden }) => {
    await signInWith([homePrivilege, privilege]);

    render(<AdminNav />);

    expect(screen.getByRole('link', { name: shown })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: hidden })).not.toBeInTheDocument();
  });

  it('shows nothing, not even its heading, to a user who may manage neither', async () => {
    await signInWith([homePrivilege]);

    const { container } = render(<AdminNav />);

    expect(container).toBeEmptyDOMElement();
  });
});
