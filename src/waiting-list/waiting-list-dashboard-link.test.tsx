import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { DashboardExtension } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import WaitingListDashboardLink from './waiting-list-dashboard-link.component';

vi.mock('@openmrs/esm-framework', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  DashboardExtension: vi.fn(() => null),
}));

describe('WaitingListDashboardLink', () => {
  it('links the home left nav to /home/act-waiting-list', async () => {
    window.spaBase = '/openmrs/spa';
    await signInWith(['App: act.waitingList']);

    render(<WaitingListDashboardLink />);

    expect(vi.mocked(DashboardExtension).mock.calls[0][0]).toEqual(
      expect.objectContaining({ path: 'act-waiting-list', basePath: '/openmrs/spa/home', title: 'waitingList' }),
    );
  });

  it('is hidden from a user without the waiting list privilege', async () => {
    await signInWith(['Get Patients']);

    render(<WaitingListDashboardLink />);

    expect(vi.mocked(DashboardExtension)).not.toHaveBeenCalled();
  });
});
