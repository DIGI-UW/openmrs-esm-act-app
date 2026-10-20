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

  it("leads User activity to the audit log app, Patients opened to the audit log module's read audit and Download log to ACT's", async () => {
    await signInWith([homePrivilege, 'View Audit Logs', 'View Read Audit Logs']);

    render(<AdminNav />);

    expect(screen.getByRole('link', { name: 'User activity' })).toHaveAttribute('href', '/openmrs/spa/audit-logs');
    expect(screen.getByRole('link', { name: 'Patients opened' })).toHaveAttribute(
      'href',
      '/openmrs/module/auditlogweb/readauditlogs.form',
    );
    expect(screen.getByRole('link', { name: 'Download log' })).toHaveAttribute(
      'href',
      '/openmrs/spa/home/act-download-log',
    );
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
      shown: ['User activity'],
      hidden: ['Users and roles', 'Patients opened', 'Clinics', 'Studies', 'Flags and adherence'],
    },
    {
      privilege: 'View Read Audit Logs',
      shown: ['Patients opened', 'Download log'],
      hidden: ['Users and roles', 'User activity', 'Clinics', 'Studies', 'Flags and adherence', 'Download data'],
    },
    {
      privilege: 'Task: act.downloadData',
      shown: ['Download data'],
      hidden: [
        'Users and roles',
        'User activity',
        'Patients opened',
        'Download log',
        'Clinics',
        'Studies',
        'Flags and adherence',
      ],
    },
    {
      privilege: 'Task: act.downloadResearchData',
      shown: ['Download data'],
      hidden: [
        'Users and roles',
        'User activity',
        'Patients opened',
        'Download log',
        'Clinics',
        'Studies',
        'Flags and adherence',
      ],
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
