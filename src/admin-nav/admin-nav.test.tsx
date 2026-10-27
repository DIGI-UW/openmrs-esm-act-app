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
    await signInWith([homePrivilege, 'Edit Users', 'Manage Locations', 'App: act.studies', 'Task: act.refreshFlags']);

    render(<AdminNav />);

    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Users and roles' })).toHaveAttribute(
      'href',
      '/openmrs/spa/home/act-users',
    );
    expect(screen.getByRole('link', { name: 'Clinics' })).toHaveAttribute('href', '/openmrs/spa/home/act-clinics');
    expect(screen.getByRole('link', { name: 'Studies' })).toHaveAttribute('href', '/openmrs/spa/home/act-studies');
    expect(screen.getByRole('link', { name: 'Flags and adherence' })).toHaveAttribute(
      'href',
      '/openmrs/spa/home/act-refresh-flags',
    );
  });

  it("leads Logs to ACT's Logs page, one item in place of User activity, Patients opened and Download log", async () => {
    await signInWith([homePrivilege, 'View Audit Logs', 'View Read Audit Logs', 'View Security Audit Logs']);

    render(<AdminNav />);

    expect(screen.getByRole('link', { name: 'Logs' })).toHaveAttribute('href', '/openmrs/spa/home/act-logs');
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(['Logs']);
  });

  it.each([
    { privilege: 'Edit Users', shown: ['Users and roles'], hidden: ['Clinics', 'Studies', 'Flags and adherence'] },
    {
      privilege: 'Manage Locations',
      shown: ['Clinics'],
      hidden: ['Users and roles', 'Studies', 'Flags and adherence'],
    },
    {
      privilege: 'App: act.studies',
      shown: ['Studies'],
      hidden: ['Users and roles', 'Clinics', 'Flags and adherence'],
    },
    {
      privilege: 'Task: act.refreshFlags',
      shown: ['Flags and adherence'],
      hidden: ['Users and roles', 'Clinics', 'Studies'],
    },
    {
      privilege: 'View Audit Logs',
      shown: ['Logs'],
      hidden: ['Users and roles', 'Clinics', 'Studies', 'Flags and adherence', 'Download data'],
    },
    {
      privilege: 'View Read Audit Logs',
      shown: ['Logs'],
      hidden: ['Users and roles', 'Clinics', 'Studies', 'Flags and adherence', 'Download data'],
    },
    {
      privilege: 'View Security Audit Logs',
      shown: ['Logs'],
      hidden: ['Users and roles', 'Clinics', 'Studies', 'Flags and adherence', 'Download data'],
    },
    {
      privilege: 'Task: act.downloadData',
      shown: ['Download data'],
      hidden: ['Users and roles', 'Logs', 'Clinics', 'Studies', 'Flags and adherence'],
    },
    {
      privilege: 'Task: act.downloadResearchData',
      shown: ['Download data'],
      hidden: ['Users and roles', 'Logs', 'Clinics', 'Studies', 'Flags and adherence'],
    },
  ])('offers only $shown to a user holding $privilege', async ({ privilege, shown, hidden }) => {
    await signInWith([homePrivilege, privilege]);

    render(<AdminNav />);

    shown.forEach((name) => expect(screen.getByRole('link', { name })).toBeInTheDocument());
    hidden.forEach((name) => expect(screen.queryByRole('link', { name })).not.toBeInTheDocument());
  });

  it('offers Admin to an administrator whose home is not ACT home, such as the Instance Administrator', async () => {
    await signInWith(['App: act.instanceAdmin', 'Edit Users', 'Task: act.refreshFlags']);

    render(<AdminNav />);

    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Users and roles' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Flags and adherence' })).toBeInTheDocument();
  });

  it('shows nothing, not even its heading, to a user who may manage neither', async () => {
    await signInWith([homePrivilege]);

    const { container } = render(<AdminNav />);

    expect(container).toBeEmptyDOMElement();
  });
});
