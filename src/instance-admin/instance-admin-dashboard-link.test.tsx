import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { DashboardExtension } from '@openmrs/esm-framework';
import { homePrivilege, signInWith } from '../access/sign-in.test-helper';
import InstanceAdminDashboardLink from './instance-admin-dashboard-link.component';

vi.mock('@openmrs/esm-framework', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  DashboardExtension: vi.fn(() => null),
}));

describe('InstanceAdminDashboardLink', () => {
  beforeEach(() => {
    window.spaBase = '/openmrs/spa';
    vi.mocked(DashboardExtension).mockClear();
  });

  it("links the Instance admin's Home left nav to /home/act-instance-admin", async () => {
    await signInWith(['App: act.instanceAdmin']);

    render(<InstanceAdminDashboardLink />);

    expect(vi.mocked(DashboardExtension).mock.calls[0][0]).toEqual(
      expect.objectContaining({ path: 'act-instance-admin', basePath: '/openmrs/spa/home', title: 'home' }),
    );
  });

  it('is left out for a user whose home is ACT home, such as a site administrator', async () => {
    await signInWith(['App: act.instanceAdmin', homePrivilege]);

    render(<InstanceAdminDashboardLink />);

    expect(DashboardExtension).not.toHaveBeenCalled();
  });
});
