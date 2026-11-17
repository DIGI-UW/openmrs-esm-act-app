import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { type AssignedExtension, useAssignedExtensions } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import routes from '../routes.json';
import InstanceAdminNav from './instance-admin-nav.component';

const homeExtensions = routes.extensions.filter((extension) => extension.slot === 'homepage-dashboard-slot');
const assign = (...names: Array<string>) =>
  vi
    .mocked(useAssignedExtensions)
    .mockImplementation((slot) =>
      slot === 'homepage-dashboard-slot'
        ? (homeExtensions.filter(({ name }) => names.includes(name)) as unknown as Array<AssignedExtension>)
        : [],
    );

describe('InstanceAdminNav', () => {
  beforeEach(() => {
    window.openmrsBase = '/openmrs';
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
  });

  it('offers Forms & sites and Role permissions to the Instance Administrator, each to the quick-action URL, leaving Studies to the Admin section', async () => {
    await signInWith(['App: act.instanceAdmin', 'Manage Roles']);
    assign('act-role-permissions-dashboard-link');

    render(<InstanceAdminNav />);

    expect(screen.getByRole('link', { name: 'Forms & sites' })).toHaveAttribute('href', '/openmrs/spa/form-builder');
    expect(screen.getByRole('link', { name: 'Role permissions' })).toHaveAttribute(
      'href',
      '/openmrs/spa/home/act-role-permissions',
    );
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(['Forms & sites', 'Role permissions']);
  });

  it("leaves out Role permissions when the home dashboard does not assign its page's link, as without Manage Roles", async () => {
    await signInWith(['App: act.instanceAdmin', 'Manage Roles']);
    assign();

    render(<InstanceAdminNav />);

    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(['Forms & sites']);
  });

  it('shows nothing to a user whose home is ACT home, as the Instance admin Home link does', async () => {
    await signInWith(['App: act.home', 'App: act.instanceAdmin']);

    const { container } = render(<InstanceAdminNav />);

    expect(container).toBeEmptyDOMElement();
  });
});
