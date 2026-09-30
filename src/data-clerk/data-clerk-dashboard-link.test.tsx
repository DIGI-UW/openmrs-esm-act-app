import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { DashboardExtension } from '@openmrs/esm-framework';
import { dataClerkPrivilege, signInWith } from '../access/sign-in.test-helper';
import DataClerkDashboardLink from './data-clerk-dashboard-link.component';

vi.mock('@openmrs/esm-framework', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  DashboardExtension: vi.fn(() => null),
}));

describe('DataClerkDashboardLink', () => {
  it('links the home left nav to /home/act-data-clerk', async () => {
    window.spaBase = '/openmrs/spa';
    await signInWith([dataClerkPrivilege]);

    render(<DataClerkDashboardLink />);

    expect(vi.mocked(DashboardExtension).mock.calls[0][0]).toEqual(
      expect.objectContaining({ path: 'act-data-clerk', basePath: '/openmrs/spa/home', title: 'dataClerk' }),
    );
  });

  it('is hidden from a user without the data clerk privilege', async () => {
    await signInWith(['View Patient Flags']);

    render(<DataClerkDashboardLink />);

    expect(vi.mocked(DashboardExtension)).not.toHaveBeenCalled();
  });
});
