import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { DashboardExtension, useSession } from '@openmrs/esm-framework';
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

  it('keeps Home for an Instance Administrator who also holds ACT home', async () => {
    await signInWith(['App: act.instanceAdmin', homePrivilege]);

    render(<InstanceAdminDashboardLink />);

    expect(DashboardExtension).toHaveBeenCalled();
  });

  it('is left out for a user whose home is ACT home without App: act.instanceAdmin, such as a global administrator', async () => {
    await signInWith([homePrivilege, 'Task: act.allClinics']);

    render(<InstanceAdminDashboardLink />);

    expect(DashboardExtension).not.toHaveBeenCalled();
  });

  it('is left out for a super user, who passes every privilege check without holding App: act.instanceAdmin', async () => {
    await signInWith([]);
    const session = vi.mocked(useSession)();
    vi.mocked(useSession).mockReturnValue({
      ...session,
      user: { ...session.user, roles: [{ uuid: 'sd', display: 'System Developer' }] },
    } as never);

    render(<InstanceAdminDashboardLink />);

    expect(DashboardExtension).not.toHaveBeenCalled();
  });
});
