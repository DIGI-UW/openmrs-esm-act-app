import React from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActionMenuButton2, getDefaultsFromConfigSchema, openmrsFetch } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { type Config, configSchema } from '../config-schema';
import { type ChartEncounter } from '../consultations/consultations.resource';
import InrTrendActionButton from './inr-trend-action-button.component';

const config = getDefaultsFromConfigSchema(configSchema) as Config;
const c = config.consultations.concepts;
const i = config.inrReviews.concepts;
const obs = (concept: string, value: unknown, groupMembers?: Array<unknown>) => ({
  concept: { uuid: concept },
  value,
  groupMembers,
});

const onWarfarin = {
  uuid: 'consultation',
  encounterDatetime: '2026-09-01T09:00:00.000+0300',
  obs: [
    obs(c.medication, null, [
      obs(c.medication, { uuid: config.consultations.vitaminKAntagonists[0], display: 'Warfarin' }),
    ]),
  ],
} as ChartEncounter;

const withInr = {
  uuid: 'inr',
  encounterDatetime: '2026-10-05T09:00:00.000+0300',
  obs: [obs(i.group, null, [obs(i.dateTested, '2026-10-05T00:00:00.000+0300'), obs(i.value, 2.6)])],
} as ChartEncounter;

function serve(consultations: Array<ChartEncounter>, inr: Array<ChartEncounter>) {
  vi.mocked(openmrsFetch).mockImplementation((async (url: string) => {
    const results = url.includes(`encounterType=${config.consultations.encounterType}`)
      ? consultations
      : url.includes(`encounterType=${config.inrReviews.encounterType}`)
        ? inr
        : [];
    return { data: { results, totalCount: results.length } };
  }) as never);
}

const renderButton = () =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <InrTrendActionButton groupProps={{ patientUuid: 'grace' }} />
    </SWRConfig>,
  );

describe('InrTrendActionButton', () => {
  beforeEach(async () => {
    vi.mocked(ActionMenuButton2).mockClear();
    await signInWith(['Get Encounters', 'Get Observations']);
  });

  it('opens the INR trend workspace, without starting a visit, for a patient with an INR', async () => {
    serve([], [withInr]);

    renderButton();

    expect(await screen.findByText('INR trend')).toBeInTheDocument();
    const props = vi
      .mocked(ActionMenuButton2)
      .mock.calls.map(([called]) => called as unknown as Record<string, unknown>)
      .find((called) => called?.workspaceToLaunch)!;
    expect(props.workspaceToLaunch).toEqual({ workspaceName: 'act-inr-trend-workspace', workspaceProps: {} });
    expect(props.onBeforeWorkspaceLaunch).toBeUndefined();
  });

  it('shows for a patient on warfarin who has no INR yet', async () => {
    serve([onWarfarin], []);

    renderButton();

    expect(await screen.findByText('INR trend')).toBeInTheDocument();
  });

  it('shows nothing for a patient who is not on warfarin and has no INR', async () => {
    serve([], []);

    const { container } = renderButton();

    await vi.waitFor(() => expect(openmrsFetch).toHaveBeenCalled());
    await vi.waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('shows nothing to a user who may not read encounters and observations', async () => {
    await signInWith(['Get Patients']);
    serve([], [withInr]);

    const { container } = renderButton();

    await vi.waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(screen.queryByText('INR trend')).not.toBeInTheDocument();
    expect(vi.mocked(openmrsFetch).mock.calls.filter(([url]) => String(url).includes('/encounter?'))).toEqual([]);
  });
});
