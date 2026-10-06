import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { DashboardExtension } from '@openmrs/esm-framework';
import { homePrivilege, signInWith } from '../access/sign-in.test-helper';
import DueForProphylaxisDashboardLink from './due-for-prophylaxis-dashboard-link.component';

vi.mock('@openmrs/esm-framework', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  DashboardExtension: vi.fn(() => null),
}));

describe('DueForProphylaxisDashboardLink', () => {
  beforeEach(() => {
    window.spaBase = '/openmrs/spa';
    vi.mocked(DashboardExtension).mockClear();
  });

  it('links the home left nav to /home/act-due-for-prophylaxis', async () => {
    await signInWith(['App: act.dueList']);

    render(<DueForProphylaxisDashboardLink />);

    expect(vi.mocked(DashboardExtension).mock.calls[0][0]).toEqual(
      expect.objectContaining({
        path: 'act-due-for-prophylaxis',
        basePath: '/openmrs/spa/home',
        title: 'Due for prophylaxis',
      }),
    );
  });

  it('is left out for a user whose home is ACT home, where the registry shows who is due', async () => {
    await signInWith(['App: act.dueList', homePrivilege]);

    render(<DueForProphylaxisDashboardLink />);

    expect(DashboardExtension).not.toHaveBeenCalled();
  });
});
