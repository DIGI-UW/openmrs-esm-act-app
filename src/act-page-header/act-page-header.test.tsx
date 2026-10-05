import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { useAssignedExtensions } from '@openmrs/esm-framework';
import { homePrivilege, signInWith } from '../access/sign-in.test-helper';
import { useReportDataset } from '../reports/report-dataset.resource';
import ActHomeDashboard from '../act-home/act-home-dashboard.component';
import Registry from '../registry/registry.component';
import WaitingList from '../waiting-list/waiting-list.component';
import ScreenPositive from '../screen-positive/screen-positive.component';
import Worklists from '../worklists/worklists.component';
import { ActPageHeader } from './act-page-header.component';

vi.mock('../reports/report-dataset.resource', () => ({ useReportDataset: vi.fn() }));

const screens = [
  {
    name: 'ACT home',
    Screen: ActHomeDashboard,
    pictogram: 'HomePictogram',
    noAccess: 'You do not have access to ACT home.',
  },
  {
    name: 'Registry',
    Screen: Registry,
    pictogram: 'PatientListsPictogram',
    noAccess: 'You do not have access to the registry.',
  },
  {
    name: 'Worklists',
    Screen: Worklists,
    pictogram: 'PatientListsPictogram',
    noAccess: 'You do not have access to the worklists.',
  },
  {
    name: 'Procedural waiting list',
    Screen: WaitingList,
    pictogram: 'CardiologyPictogram',
    noAccess: 'You do not have access to the procedural waiting list.',
  },
  {
    name: 'Screen positive, pending confirmation',
    Screen: ScreenPositive,
    pictogram: 'CardiologyPictogram',
    noAccess: 'You do not have access to the screen positive, pending confirmation list.',
  },
];

describe('ACT page header', () => {
  beforeEach(() => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    vi.mocked(useAssignedExtensions).mockReturnValue([]);
    vi.mocked(useReportDataset).mockReturnValue({
      columns: [],
      rows: [],
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    } as never);
  });

  it.each(screens)(
    'starts $name with the framework page header, its title and pictogram',
    async ({ Screen, name, pictogram }) => {
      await signInWith([
        homePrivilege,
        'App: act.registry',
        'App: act.worklists',
        'App: act.waitingList',
        'App: act.screenPositive',
      ]);

      render(<Screen />);

      const header = screen.getByTestId('act-page-header');
      expect(within(header).getByText(name)).toBeInTheDocument();
      expect(within(header).getByText(pictogram)).toBeInTheDocument();
      // The header replaces each screen's own heading rather than sitting beside it.
      expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    },
  );

  it.each(screens)('shows $name no header to a user who may not see it', async ({ Screen, noAccess }) => {
    await signInWith(['Get Patients']);

    render(<Screen />);

    expect(screen.getByText(noAccess)).toBeInTheDocument();
    expect(screen.queryByTestId('act-page-header')).not.toBeInTheDocument();
  });

  it('shows actions on the right when given them', () => {
    render(<ActPageHeader title="Title" illustration={<span>Pictogram</span>} actions={<button>Act</button>} />);

    expect(within(screen.getByTestId('act-page-header')).getByRole('button', { name: 'Act' })).toBeInTheDocument();
  });
});
