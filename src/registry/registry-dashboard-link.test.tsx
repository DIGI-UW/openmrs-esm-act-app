import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { DashboardExtension } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import RegistryDashboardLink from './registry-dashboard-link.component';

vi.mock('@openmrs/esm-framework', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  DashboardExtension: vi.fn(() => null),
}));

describe('RegistryDashboardLink', () => {
  it('links the home left nav to /home/act-registry', async () => {
    window.spaBase = '/openmrs/spa';
    await signInWith(['App: act.registry']);

    render(<RegistryDashboardLink />);

    expect(vi.mocked(DashboardExtension).mock.calls[0][0]).toEqual(
      expect.objectContaining({ path: 'act-registry', basePath: '/openmrs/spa/home', title: 'registry' }),
    );
  });
});
