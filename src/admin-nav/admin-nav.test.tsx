import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { type AssignedExtension, useAssignedExtensions } from '@openmrs/esm-framework';
import { homePrivilege, signInWith } from '../access/sign-in.test-helper';
import routes from '../routes.json';
import AdminNav from './admin-nav.component';

const homeExtensions = routes.extensions.filter((extension) => extension.slot === 'homepage-dashboard-slot');
const assign = (...names: Array<string>) =>
  vi
    .mocked(useAssignedExtensions)
    .mockReturnValue(homeExtensions.filter(({ name }) => names.includes(name)) as unknown as Array<AssignedExtension>);
const links = () => screen.queryAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')]);

describe('AdminNav', () => {
  beforeEach(async () => {
    window.openmrsBase = '/openmrs';
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    await signInWith([homePrivilege]);
  });

  it('offers each Admin page whose link the home dashboard assigns, under Admin, leading to it', () => {
    assign(...homeExtensions.map(({ name }) => name));

    render(<AdminNav />);

    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(links()).toEqual([
      ['Users and roles', '/openmrs/spa/home/act-users'],
      ['Logs', '/openmrs/spa/home/act-logs'],
      ['Clinics', '/openmrs/spa/home/act-clinics'],
      ['Studies', '/openmrs/spa/home/act-studies'],
      ['Screening counts', '/openmrs/spa/home/act-screening-counts'],
      ['Flags and adherence', '/openmrs/spa/home/act-refresh-flags'],
      ['Download data', '/openmrs/spa/home/act-download'],
    ]);
  });

  it.each([
    ['act-users-dashboard-link', 'Users and roles'],
    ['act-logs-dashboard-link', 'Logs'],
    ['act-clinics-dashboard-link', 'Clinics'],
    ['act-studies-dashboard-link', 'Studies'],
    ['act-screening-counts-dashboard-link', 'Screening counts'],
    ['act-refresh-flags-dashboard-link', 'Flags and adherence'],
    ['act-download-dashboard-link', 'Download data'],
  ])('offers only %s, as %s, when it alone is assigned', (name, label) => {
    assign(name);

    render(<AdminNav />);

    expect(links().map(([text]) => text)).toEqual([label]);
  });

  it("follows the home dashboard's assignment rather than the user's privileges", async () => {
    await signInWith(['Edit Users', 'Manage Locations', 'App: act.studies', 'Task: act.refreshFlags']);
    assign('act-studies-dashboard-link');

    render(<AdminNav />);

    expect(links().map(([text]) => text)).toEqual(['Studies']);
  });

  it('shows nothing, not even its heading, when no Admin page is assigned', () => {
    assign();

    const { container } = render(<AdminNav />);

    expect(container).toBeEmptyDOMElement();
  });
});
