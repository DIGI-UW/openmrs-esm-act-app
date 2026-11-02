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

  it('offers Forms & sites and Role permissions to the Instance Administrator, each to the quick-action URL, leaving Studies to the Admin section', async () => {
    await signInWith(['App: act.instanceAdmin']);

    render(<InstanceAdminNav />);

    expect(screen.getByRole('link', { name: 'Forms & sites' })).toHaveAttribute('href', '/openmrs/spa/form-builder');
    expect(screen.getByRole('link', { name: 'Role permissions' })).toHaveAttribute(
      'href',
      '/openmrs/spa/home/act-role-permissions',
    );
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(['Forms & sites', 'Role permissions']);
  });

  it('shows nothing to a user whose home is ACT home, as the Instance admin Home link does', async () => {
    await signInWith(['App: act.home', 'App: act.instanceAdmin']);

    const { container } = render(<InstanceAdminNav />);

    expect(container).toBeEmptyDOMElement();
  });
});
