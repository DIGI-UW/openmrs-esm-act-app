import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { signInWith } from '../access/sign-in.test-helper';
import InstanceAdminNav from './instance-admin-nav.component';

describe('InstanceAdminNav', () => {
  beforeEach(() => {
    window.openmrsBase = '/openmrs';
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
  });

  it('offers Forms & sites, Role permissions and Research participation to the Instance Administrator, each to the quick-action URL', async () => {
    await signInWith(['App: act.instanceAdmin']);

    render(<InstanceAdminNav />);

    expect(screen.getByRole('link', { name: 'Forms & sites' })).toHaveAttribute(
      'href',
      '/openmrs/admin/forms/form.list',
    );
    expect(screen.getByRole('link', { name: 'Role permissions' })).toHaveAttribute(
      'href',
      '/openmrs/spa/home/act-role-permissions',
    );
    expect(screen.getByRole('link', { name: 'Research participation' })).toHaveAttribute(
      'href',
      '/openmrs/admin/maintenance/settings.list',
    );
  });

  it('shows nothing to a user whose home is ACT home, as the Instance admin Home link does', async () => {
    await signInWith(['App: act.home', 'App: act.instanceAdmin']);

    const { container } = render(<InstanceAdminNav />);

    expect(container).toBeEmptyDOMElement();
  });
});
