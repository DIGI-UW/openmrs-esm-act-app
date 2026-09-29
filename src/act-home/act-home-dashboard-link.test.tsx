import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { DashboardExtension } from '@openmrs/esm-framework';
import { homePrivilege, signInWith } from '../access/sign-in.test-helper';
import ActHomeDashboardLink from './act-home-dashboard-link.component';

vi.mock('@openmrs/esm-framework', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  DashboardExtension: vi.fn(() => null),
}));

describe('ActHomeDashboardLink', () => {
  it('links the home left nav to /home/act-home', async () => {
    window.spaBase = '/openmrs/spa';
    await signInWith([homePrivilege]);

    render(<ActHomeDashboardLink />);

    expect(vi.mocked(DashboardExtension).mock.calls[0][0]).toEqual(
      expect.objectContaining({ path: 'act-home', basePath: '/openmrs/spa/home', title: 'actHome' }),
    );
  });

  it('is hidden from a user without the ACT home privilege', async () => {
    await signInWith(['View Patient Flags']);

    render(<ActHomeDashboardLink />);

    expect(vi.mocked(DashboardExtension)).not.toHaveBeenCalled();
  });
});
