import React from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getDefaultsFromConfigSchema, launchWorkspace2, openmrsFetch } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { type Config, configSchema } from '../config-schema';
import { type ChartEncounter } from '../consultations/consultations.resource';
import InrTrendWorkspace from './inr-trend.workspace';

vi.mock('@carbon/charts-react', async () => ({
  ...(await vi.importActual<object>('@carbon/charts-react')),
  AreaChart: vi.fn(() => <div data-testid="area-chart" />),
}));

const openForm = vi.fn();
vi.mock('../visits/open-form-in-visit', () => ({
  useOpenFormInVisit: vi.fn(() => ({ open: openForm, isOpening: false })),
}));

const config = getDefaultsFromConfigSchema(configSchema) as Config;
const i = config.inrReviews.concepts;
const obs = (concept: string, value: unknown, groupMembers?: Array<unknown>) => ({
  concept: { uuid: concept },
  value,
  groupMembers,
});
const inrEncounter = (uuid: string, tested: string, value: number) =>
  ({
    uuid,
    encounterDatetime: `${tested}T09:00:00.000+0300`,
    obs: [
      {
        uuid: `${uuid}-group`,
        ...obs(i.group, null, [obs(i.dateTested, `${tested}T00:00:00.000+0300`), obs(i.value, value)]),
      },
    ],
  }) as ChartEncounter;

function serve(inr: Array<ChartEncounter>, mayEnter = true) {
  vi.mocked(openmrsFetch).mockImplementation((async (url: string) => {
    if (url.includes('/form/')) {
      return {
        data: { uuid: 'form', encounterType: { editPrivilege: mayEnter ? null : { display: 'Task: nobody' } } },
      };
    }
    const results = url.includes(`encounterType=${config.inrReviews.encounterType}`) ? inr : [];
    return { data: { results, totalCount: results.length } };
  }) as never);
}

const renderWorkspace = () =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <InrTrendWorkspace
        workspaceProps={null}
        windowProps={null}
        groupProps={{ patientUuid: 'grace' }}
        launchChildWorkspace={vi.fn()}
        closeWorkspace={vi.fn()}
        workspaceName="act-inr-trend-workspace"
        windowName="act-inr-trend"
        isRootWorkspace
        showActionMenu={false}
      />
    </SWRConfig>,
  );

describe('InrTrendWorkspace', () => {
  beforeEach(async () => {
    await signInWith(['Get Encounters', 'Get Observations', 'Add Encounters', 'Edit Encounters']);
  });

  it('shows the INR trend, and opens the editor for the latest INR and the form for a new one', async () => {
    serve([inrEncounter('older', '2026-08-01', 1.8), inrEncounter('latest', '2026-10-05', 2.6)]);

    renderWorkspace();

    expect(await screen.findByTestId('area-chart')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit INR' }));
    expect(launchWorkspace2).toHaveBeenCalledWith('act-inr-edit-workspace', {
      encounterUuid: 'latest',
      groupUuid: 'latest-group',
    });
    await userEvent.click(screen.getByRole('button', { name: 'Record new INR' }));
    expect(openForm).toHaveBeenCalledWith(config.inrReviews.form);
  });

  it('offers nothing to change to a user who may not record the INR form', async () => {
    serve([inrEncounter('older', '2026-08-01', 1.8), inrEncounter('latest', '2026-10-05', 2.6)], false);

    renderWorkspace();

    expect(await screen.findByTestId('area-chart')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /INR/ })).not.toBeInTheDocument();
  });
});
