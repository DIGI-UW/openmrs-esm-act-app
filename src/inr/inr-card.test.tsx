import React from 'react';
import { SWRConfig } from 'swr';
import dayjs from 'dayjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  type AssignedExtension,
  getAssignedExtensions,
  getDefaultsFromConfigSchema,
  openmrsFetch,
  useAssignedExtensions,
} from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { type Config, configSchema } from '../config-schema';
import { type ChartEncounter } from '../consultations/consultations.resource';
import InrCard from './inr-card.component';
import InrStatusFlag from './inr-status-flag.component';

// The framework's test mock has no getAssignedExtensions, which reads a dashboard group's slot.
vi.mock('@openmrs/esm-framework', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getAssignedExtensions: vi.fn(() => []),
}));

// The INR reviews page as a site's config may rename it.
const inrPage = { name: 'act-inr-reviews-dashboard-link', meta: { path: 'act-inr-reviews' }, config: { path: 'inr' } };

const ago = (days: number) => dayjs().subtract(days, 'day').format('YYYY-MM-DD');
const config = getDefaultsFromConfigSchema(configSchema) as Config;
const c = config.consultations.concepts;
const i = config.inrReviews.concepts;
const coded = (uuid: string, display: string) => ({ uuid, display });
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
      obs(c.medication, coded(config.consultations.vitaminKAntagonists[0], 'Warfarin')),
      obs(c.medicationDose, '5 mg daily'),
    ]),
  ],
} as ChartEncounter;

function reading(
  tested: string,
  value: number,
  { target = '2.0 - 3.0', next = '', change = '', newDose = '', indication = '' } = {},
) {
  return {
    uuid: `inr-${tested}`,
    encounterDatetime: `${tested}T09:00:00.000+0300`,
    obs: [
      ...(indication ? [obs(i.indication, coded('indication', indication))] : []),
      ...(target ? [obs(i.target, coded('target', target))] : []),
      obs(i.group, null, [
        obs(i.dateTested, `${tested}T12:00:00.000+0300`),
        obs(i.value, value),
        ...(change ? [obs(i.doseChange, coded('change', change))] : []),
        ...(newDose ? [obs(i.newDose, newDose)] : []),
      ]),
      ...(next ? [obs(i.nextInr, `${next}T12:00:00.000+0300`)] : []),
    ],
  } as ChartEncounter;
}

function serve(consultations: Array<ChartEncounter>, inr: Array<ChartEncounter>, updates: Array<ChartEncounter> = []) {
  vi.mocked(openmrsFetch).mockImplementation((async (url: string) => {
    const results = url.includes(`encounterType=${config.consultations.encounterType}`)
      ? consultations
      : url.includes(`encounterType=${config.inrReviews.encounterType}`)
        ? inr
        : url.includes(`encounterType=${config.medications.encounterType}`)
          ? updates
          : [];
    return { data: { results, totalCount: results.length } };
  }) as never);
}

const renderIn = (element: React.ReactElement) =>
  render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{element}</SWRConfig>);

const showReadings = async () => userEvent.click(await screen.findByRole('button', { name: /Show readings/ }));

describe('InrCard', () => {
  beforeEach(async () => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    await signInWith(['Get Encounters', 'Get Observations']);
    vi.mocked(useAssignedExtensions).mockReturnValue([inrPage] as unknown as Array<AssignedExtension>);
    vi.mocked(getAssignedExtensions).mockReturnValue([]);
  });

  it('shows the indication, target, next INR and dose, then the chart and each reading with its words and dose change', async () => {
    serve(
      [onWarfarin],
      [
        reading('2026-09-28', 2.2, { next: '2026-10-05', indication: 'Atrial fibrillation' }),
        reading('2026-10-12', 3.1, {
          next: '2026-11-09',
          change: 'Yes',
          newDose: '4 mg',
          indication: 'Atrial fibrillation',
        }),
      ],
    );

    renderIn(<InrCard patientUuid="grace" />);

    expect(await screen.findByTestId('inr-indication')).toHaveTextContent('Atrial fibrillation');
    expect(screen.getByTestId('inr-target')).toHaveTextContent('2.0 - 3.0');
    expect(screen.getByTestId('inr-next')).toHaveTextContent('09-Nov-2026');
    expect(screen.getByTestId('inr-dose')).toHaveTextContent('4 mg');
    expect(screen.queryByRole('img', { name: /INR over time/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId('inr-reading')).not.toBeInTheDocument();
    await showReadings();
    expect(screen.getByRole('img', { name: /INR over time: 2\.2.*3\.1/ })).toBeInTheDocument();
    const [newest, older] = screen.getAllByTestId('inr-reading');
    expect(newest).toHaveTextContent('3.1 · above target');
    expect(newest).toHaveTextContent('Yes, 4 mg');
    expect(within(newest).getByTestId('inr-tone')).toHaveAttribute('data-tone', 'orange');
    expect(within(older).getByTestId('inr-tone')).toHaveAttribute('data-tone', 'green');
    expect(older).toHaveTextContent('2.2 · in range');
  });

  it('hides the chart and readings again when Hide readings is pressed', async () => {
    serve([onWarfarin], [reading('2026-10-12', 3.1)]);

    renderIn(<InrCard patientUuid="grace" />);

    await showReadings();
    expect(await screen.findByTestId('inr-reading')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Hide readings/ }));
    expect(screen.queryByTestId('inr-reading')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Show readings/ })).toHaveAttribute('aria-expanded', 'false');
  });

  it('takes the indication from the newest INR that records one', async () => {
    serve(
      [onWarfarin],
      [reading('2026-09-28', 2.2, { indication: 'Atrial fibrillation' }), reading('2026-10-12', 3.1)],
    );

    renderIn(<InrCard patientUuid="grace" />);

    expect(await screen.findByTestId('inr-indication')).toHaveTextContent('Atrial fibrillation');
  });

  it('judges a reading against the target its own INR Monitoring records, and marks that target on the chart', async () => {
    serve([onWarfarin], [reading('2026-10-12', 3.2, { target: '2.5 - 3.5' })]);

    renderIn(<InrCard patientUuid="grace" />);

    await showReadings();
    expect(await screen.findByTestId('inr-reading')).toHaveTextContent('3.2 · in range');
    expect(screen.getByText(/Target 2\.5-3\.5/)).toBeInTheDocument();
  });

  it('shows the five newest readings, and a See all link to the INR reviews page past five', async () => {
    serve(
      [onWarfarin],
      ['2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31', '2026-09-07'].map((day) =>
        reading(day, 2.5),
      ),
    );

    renderIn(<InrCard patientUuid="grace" />);

    await showReadings();
    expect(await screen.findAllByTestId('inr-reading')).toHaveLength(5);
    expect(screen.getByRole('link', { name: 'See all' })).toHaveAttribute(
      'href',
      expect.stringContaining('/patient/grace/chart/inr'),
    );
  });

  it("shows no See all link when the chart's nav has no INR reviews page", async () => {
    vi.mocked(useAssignedExtensions).mockReturnValue([]);
    serve(
      [onWarfarin],
      ['2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31', '2026-09-07'].map((day) =>
        reading(day, 2.5),
      ),
    );

    renderIn(<InrCard patientUuid="grace" />);

    await showReadings();
    expect(await screen.findAllByTestId('inr-reading')).toHaveLength(5);
    expect(screen.queryByRole('link', { name: 'See all' })).not.toBeInTheDocument();
  });

  it('shows no See all link for five readings or fewer', async () => {
    serve([onWarfarin], [reading('2026-09-07', 2.5)]);

    renderIn(<InrCard patientUuid="grace" />);

    await showReadings();
    await screen.findByTestId('inr-reading');
    expect(screen.queryByRole('link', { name: 'See all' })).not.toBeInTheDocument();
  });

  it('says no INR is recorded for a patient on warfarin who has none, and shows nothing for a patient with neither', async () => {
    serve([onWarfarin], []);
    const { unmount } = renderIn(<InrCard patientUuid="grace" />);
    expect(await screen.findByText('No INR recorded')).toBeInTheDocument();
    unmount();

    serve([], []);
    const { container } = renderIn(<InrCard patientUuid="grace" />);
    await vi.waitFor(() => expect(openmrsFetch).toHaveBeenCalled());
    await vi.waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});

describe('InrStatusFlag', () => {
  beforeEach(async () => {
    await signInWith(['Get Encounters', 'Get Observations']);
  });

  it('adds the latest INR to the banner when it is above or below its target, and not when it is in range', async () => {
    serve([onWarfarin], [reading(ago(10), 3.1)]);
    const { unmount: unmountAbove } = renderIn(<InrStatusFlag patientUuid="grace" />);
    expect(await screen.findByTestId('inr-value-status')).toHaveTextContent('INR 3.1 above target');
    unmountAbove();

    serve([onWarfarin], [reading(ago(10), 1.7)]);
    const { unmount: unmountBelow } = renderIn(<InrStatusFlag patientUuid="grace" />);
    expect(await screen.findByTestId('inr-value-status')).toHaveTextContent('INR 1.7 below target');
    unmountBelow();

    serve([onWarfarin], [reading(ago(10), 2.4)]);
    renderIn(<InrStatusFlag patientUuid="grace" />);
    await vi.waitFor(() => expect(openmrsFetch).toHaveBeenCalled());
    await vi.waitFor(() => expect(screen.queryByTestId('inr-value-status')).not.toBeInTheDocument());
  });

  it('shows the value pill for a reading within three months and not for an older one', async () => {
    serve([onWarfarin], [reading(ago(100), 3.1, { next: ago(50) })]);
    const { unmount } = renderIn(<InrStatusFlag patientUuid="grace" />);
    expect(await screen.findByTestId('inr-status')).toHaveTextContent('INR overdue');
    expect(screen.queryByTestId('inr-value-status')).not.toBeInTheDocument();
    unmount();

    serve([onWarfarin], [reading(ago(60), 3.1)]);
    renderIn(<InrStatusFlag patientUuid="grace" />);
    expect(await screen.findByTestId('inr-value-status')).toHaveTextContent('INR 3.1 above target');
  });

  it('flags a patient whose only warfarin is a Medication Update', async () => {
    serve([], [reading(ago(10), 3.1)], [onWarfarin]);
    renderIn(<InrStatusFlag patientUuid="grace" />);
    expect(await screen.findByTestId('inr-value-status')).toHaveTextContent('INR 3.1 above target');
  });

  it('shows nothing for a patient who is not on warfarin', async () => {
    serve([], [reading(ago(10), 3.1)]);

    const { container } = renderIn(<InrStatusFlag patientUuid="grace" />);

    await vi.waitFor(() => expect(openmrsFetch).toHaveBeenCalled());
    await vi.waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
