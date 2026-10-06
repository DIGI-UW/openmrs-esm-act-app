import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { DashboardExtension } from '@openmrs/esm-framework';
import { homePrivilege, signInWith } from '../access/sign-in.test-helper';
import CommunityHomeDashboardLink from './community-home-dashboard-link.component';

vi.mock('@openmrs/esm-framework', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  DashboardExtension: vi.fn(() => null),
}));

describe('CommunityHomeDashboardLink', () => {
  beforeEach(() => {
    window.spaBase = '/openmrs/spa';
    vi.mocked(DashboardExtension).mockClear();
  });

  it('links the home left nav to /home/act-community-home', async () => {
    await signInWith(['App: act.communityHome']);

    render(<CommunityHomeDashboardLink />);

    expect(vi.mocked(DashboardExtension).mock.calls[0][0]).toEqual(
      expect.objectContaining({ path: 'act-community-home', basePath: '/openmrs/spa/home', title: 'home' }),
    );
  });

  it('is left out for an administrator who works from ACT home and manages users', async () => {
    await signInWith(['App: act.communityHome', homePrivilege, 'Edit Users']);

    render(<CommunityHomeDashboardLink />);

    expect(DashboardExtension).not.toHaveBeenCalled();
  });

  it('stays for a user who also works from ACT home but manages no users, as a clinician who is also a community clinician', async () => {
    await signInWith(['App: act.communityHome', homePrivilege]);

    render(<CommunityHomeDashboardLink />);

    expect(DashboardExtension).toHaveBeenCalled();
  });
});
