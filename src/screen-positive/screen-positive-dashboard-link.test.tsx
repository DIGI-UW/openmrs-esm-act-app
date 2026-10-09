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
  it('links the home left nav to /home/act-screen-positive, as v2 names it', async () => {
    window.spaBase = '/openmrs/spa';
    await signInWith(['App: act.screenPositive']);

    render(<ScreenPositiveDashboardLink />);

    expect(vi.mocked(DashboardExtension).mock.calls[0][0]).toEqual(
      expect.objectContaining({
        path: 'act-screen-positive',
        basePath: '/openmrs/spa/home',
        title: 'Confirmatory echo due',
      }),
    );
  });

  it('is left out for a user with the worklists, whose tile opens it', async () => {
    await signInWith(['App: act.screenPositive', 'App: act.worklists']);

    render(<ScreenPositiveDashboardLink />);

    expect(vi.mocked(DashboardExtension)).not.toHaveBeenCalled();
  });
});
