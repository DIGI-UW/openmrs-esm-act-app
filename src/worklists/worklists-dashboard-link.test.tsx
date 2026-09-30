import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { DashboardExtension } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import WorklistsDashboardLink from './worklists-dashboard-link.component';

vi.mock('@openmrs/esm-framework', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  DashboardExtension: vi.fn(() => null),
}));

describe('WorklistsDashboardLink', () => {
  it('links the home left nav to /home/act-worklists', async () => {
    window.spaBase = '/openmrs/spa';
    await signInWith(['View Patient Flags']);

    render(<WorklistsDashboardLink />);

    expect(vi.mocked(DashboardExtension).mock.calls[0][0]).toEqual(
      expect.objectContaining({ path: 'act-worklists', basePath: '/openmrs/spa/home', title: 'worklists' }),
    );
  });

  it('is hidden from a user without the worklists privilege', async () => {
    await signInWith(['Get Patients']);

    render(<WorklistsDashboardLink />);

    expect(vi.mocked(DashboardExtension)).not.toHaveBeenCalled();
  });
});
