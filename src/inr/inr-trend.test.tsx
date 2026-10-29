import React from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AreaChart } from '@carbon/charts-react';
import { getDefaultsFromConfigSchema, openmrsFetch } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { type Config, configSchema } from '../config-schema';
import { type ChartEncounter } from '../consultations/consultations.resource';
import InrTrend, { inrChartData, standardTarget } from './inr-trend.component';
import { toInrReviews } from './inr.resource';

vi.mock('@carbon/charts-react', async () => ({
  ...(await vi.importActual<object>('@carbon/charts-react')),
  AreaChart: vi.fn(() => <div data-testid="area-chart" />),
}));

const config = getDefaultsFromConfigSchema(configSchema) as Config;
const c = config.consultations.concepts;
const i = config.inrReviews.concepts;
const coded = (uuid: string, display: string) => ({ uuid, display });
const obs = (concept: string, value: unknown, groupMembers?: Array<unknown>) => ({
  concept: { uuid: concept },
  value,
  groupMembers,
});

const onWarfarin = (): ChartEncounter =>
  ({
    uuid: 'consultation',
    encounterDatetime: '2026-09-01T09:00:00.000+0300',
    obs: [
      obs(c.medication, null, [
        obs(c.medication, coded(config.consultations.vitaminKAntagonists[0], 'Warfarin')),
        obs(c.medicationDose, '5 mg daily'),
      ]),
    ],
  }) as ChartEncounter;

const inrEncounter = (tested: string, value: number, target = '2.0 - 3.0'): ChartEncounter =>
  ({
    uuid: `inr-${tested}`,
    encounterDatetime: `${tested}T09:00:00.000+0300`,
    obs: [
      ...(target ? [obs(i.target, coded('target', target))] : []),
      obs(i.group, null, [obs(i.dateTested, `${tested}T00:00:00.000+0300`), obs(i.value, value)]),
    ],
  }) as ChartEncounter;

function serve({ consultations = [] as Array<ChartEncounter>, inr = [] as Array<ChartEncounter>, fails = false } = {}) {
  vi.mocked(openmrsFetch).mockImplementation((async (url: string) => {
    if (fails && url.includes(`encounterType=${config.inrReviews.encounterType}`)) {
      throw new Error('403');
    }
    if (url.includes(`encounterType=${config.consultations.encounterType}`)) {
      return { data: { results: consultations, totalCount: consultations.length } };
    }
    if (url.includes(`encounterType=${config.inrReviews.encounterType}`)) {
      return { data: { results: inr, totalCount: inr.length } };
    }
    return { data: { results: [], totalCount: 0 } };
  }) as never);
}

const renderTrend = () =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <InrTrend patientUuid="grace" />
    </SWRConfig>,
  );

const lastChart = () => vi.mocked(AreaChart).mock.calls.at(-1)![0] as unknown as { data: Array<any>; options: any };

describe('inrChartData', () => {
  const reviews = (encounters: Array<ChartEncounter>) => toInrReviews(encounters, i);

  it("lists the values oldest first, each with its encounter's target as the band", () => {
    const data = inrChartData(
      reviews([inrEncounter('2026-10-05', 2.6, '2.5 - 3.5'), inrEncounter('2026-08-01', 1.8, '2.0 - 3.0')]),
      'INR',
    );

    expect(data.map((point) => [point.value, point.low, point.high])).toEqual([
      [1.8, 2, 3],
      [2.6, 2.5, 3.5],
    ]);
  });

  it('gives an INR with no recorded target the latest known one, and else the standard range', () => {
    const data = inrChartData(
      reviews([inrEncounter('2026-10-05', 2.6, ''), inrEncounter('2026-08-01', 1.8, '2.5 - 3.5')]),
      'INR',
    );
    expect(data.map((point) => [point.low, point.high])).toEqual([
      [2.5, 3.5],
      [2.5, 3.5],
    ]);

    const none = inrChartData(reviews([inrEncounter('2026-10-05', 2.6, '')]), 'INR');
    expect([none[0].low, none[0].high]).toEqual(standardTarget);
  });

  it('skips an encounter with no INR value', () => {
    const noValue = { ...inrEncounter('2026-09-01', 2), obs: [obs(i.target, coded('target', '2.0 - 3.0'))] };

    expect(inrChartData(reviews([inrEncounter('2026-10-05', 2.6), noValue as ChartEncounter]), 'INR')).toHaveLength(1);
  });
});

describe('the consultation form INR trend', () => {
  beforeEach(async () => {
    vi.mocked(AreaChart).mockClear();
    await signInWith(['Get Encounters', 'Get Observations']);
  });

  it('draws the INR over time with the target range as its band, on an axis that reaches at least 5', async () => {
    serve({
      consultations: [onWarfarin()],
      inr: [inrEncounter('2026-10-05', 2.6), inrEncounter('2026-08-01', 1.8)],
    });

    renderTrend();

    expect(await screen.findByTestId('area-chart')).toBeInTheDocument();
    const { data, options } = lastChart();
    expect(data.map((point) => point.value)).toEqual([1.8, 2.6]);
    expect(options.bounds).toEqual({ upperBoundMapsTo: 'high', lowerBoundMapsTo: 'low' });
    expect(options.axes.left.domain).toEqual([0, 5]);
  });

  it('draws it for a patient with INR results who is not on warfarin', async () => {
    serve({ inr: [inrEncounter('2026-10-05', 2.6)] });

    renderTrend();

    expect(await screen.findByTestId('area-chart')).toBeInTheDocument();
  });

  it('says no INR is recorded for a patient on warfarin who has none', async () => {
    serve({ consultations: [onWarfarin()] });

    renderTrend();

    expect(await screen.findByText('No INR recorded')).toBeInTheDocument();
    expect(screen.queryByTestId('area-chart')).not.toBeInTheDocument();
  });

  it('shows nothing for a patient who is not on warfarin and has no INR', async () => {
    serve();

    const { container } = renderTrend();

    await vi.waitFor(() => expect(openmrsFetch).toHaveBeenCalled());
    await vi.waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('says the INR could not be loaded when it cannot be read, never that none is recorded', async () => {
    serve({ consultations: [onWarfarin()], fails: true });

    renderTrend();

    expect(await screen.findByText('The INR could not be loaded')).toBeInTheDocument();
    expect(screen.queryByText('No INR recorded')).not.toBeInTheDocument();
  });
});
