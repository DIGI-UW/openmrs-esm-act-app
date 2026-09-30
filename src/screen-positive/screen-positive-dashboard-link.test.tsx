import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { DashboardExtension } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import ScreenPositiveDashboardLink from './screen-positive-dashboard-link.component';

vi.mock('@openmrs/esm-framework', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  DashboardExtension: vi.fn(() => null),
}));

describe('ScreenPositiveDashboardLink', () => {
  it('links the home left nav to /home/act-screen-positive, with a label short enough for one line', async () => {
    window.spaBase = '/openmrs/spa';
    await signInWith(['View Patient Flags']);

    render(<ScreenPositiveDashboardLink />);

    expect(vi.mocked(DashboardExtension).mock.calls[0][0]).toEqual(
      expect.objectContaining({ path: 'act-screen-positive', basePath: '/openmrs/spa/home', title: 'Screen positive' }),
    );
  });

  it('is hidden from a user without the screen positive privilege', async () => {
    await signInWith(['Get Patients']);

    render(<ScreenPositiveDashboardLink />);

    expect(vi.mocked(DashboardExtension)).not.toHaveBeenCalled();
  });
});
