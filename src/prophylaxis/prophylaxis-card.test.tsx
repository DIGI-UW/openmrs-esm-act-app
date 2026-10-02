import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ScopedMutator, SWRConfig, useSWRConfig } from 'swr';
import { getDefaultsFromConfigSchema, openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import { type Config, configSchema } from '../config-schema';
import { useOpenFormInVisit } from '../visits/open-form-in-visit';
import ProphylaxisCard from './prophylaxis-card.component';

vi.mock('../visits/open-form-in-visit', () => ({ useOpenFormInVisit: vi.fn() }));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const openForm = vi.fn();

// Winnie Auma on the seeded distro, from actcore's prophylaxis endpoint.
const winnie = {
  regimen: 'Q28 day BPG',
  type: 'BPG',
  intervalDays: 28,
  lastGiven: '2026-08-13',
  nextDue: '2026-09-10',
  status: 'overdue',
  onTime: { given: 3, total: 4, months: 6 },
};

function respondWith(summary: object | Error) {
  mockOpenmrsFetch.mockImplementation((() =>
    summary instanceof Error ? Promise.reject(summary) : Promise.resolve({ data: summary })) as never);
}

let mutateCache: ScopedMutator;

function CacheMutator() {
  mutateCache = useSWRConfig().mutate;
  return null;
}

function renderCard() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
      <CacheMutator />
      <ProphylaxisCard patientUuid="winnie" />
    </SWRConfig>,
  );
}

// The chart's invalidatePatientEncounters, which the forms app runs after every save.
const invalidatePatientEncounters = (patientUuid: string) =>
  mutateCache(
    (key) =>
      typeof key === 'string' && key.includes(`${restBaseUrl}/encounter`) && key.includes(`patient=${patientUuid}`),
  );

const field = (name: string) => screen.getByTestId(`prophylaxis-${name}`);

describe('ProphylaxisCard', () => {
  beforeEach(() => {
    vi.mocked(useConfig<Config>).mockReturnValue(getDefaultsFromConfigSchema(configSchema) as Config);
    vi.mocked(useOpenFormInVisit).mockReturnValue({ open: openForm, isOpening: false });
  });

  it('shows the regimen, last dose, overdue next due and on-time count', async () => {
    respondWith(winnie);

    renderCard();

    expect(await screen.findByText('BPG · every 4 weeks')).toBeInTheDocument();
    expect(field('last-dose')).toHaveTextContent('13-Aug-2026');
    expect(field('next-due')).toHaveTextContent(/^10-Sept?-2026$/);
    expect(field('next-due')).toHaveAttribute('data-overdue', 'true');
    expect(field('on-time')).toHaveTextContent('3 of 4');
  });

  it.each(['ok', 'dueSoon', 'dueToday'])('does not mark a next due that is %s', async (status) => {
    respondWith({ ...winnie, status, nextDue: '2026-10-20' });

    renderCard();

    await screen.findByText('BPG · every 4 weeks');
    expect(field('next-due')).toHaveAttribute('data-overdue', 'false');
  });

  it('counts a regimen that is not whole weeks in days', async () => {
    respondWith({ ...winnie, regimen: 'Q10 day BPG', intervalDays: 10 });

    renderCard();

    expect(await screen.findByText('BPG · every 10 days')).toBeInTheDocument();
  });

  it('shows an oral regimen with no on-time count', async () => {
    respondWith({ ...winnie, type: 'Oral', intervalDays: 0, onTime: null, status: 'ok' });

    renderCard();

    expect(await screen.findByText('Oral')).toBeInTheDocument();
    expect(field('on-time')).toHaveTextContent('--');
  });

  it('says No prescription for a BPG summary with no interval', async () => {
    respondWith({ ...winnie, intervalDays: null });

    renderCard();

    expect(await screen.findByText('No prescription')).toBeInTheDocument();
  });

  it('says No prescription for a patient with none in force', async () => {
    respondWith({
      regimen: null,
      type: null,
      intervalDays: null,
      lastGiven: null,
      nextDue: null,
      status: 'none',
      onTime: null,
    });

    renderCard();

    expect(await screen.findByText('No prescription')).toBeInTheDocument();
    expect(field('last-dose')).toHaveTextContent('--');
    expect(field('next-due')).toHaveTextContent('--');
  });

  it('shows nothing when the summary cannot be read', async () => {
    respondWith(new Error('Privilege required: Get Observations'));

    const { container } = renderCard();

    await waitFor(() => expect(mockOpenmrsFetch).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    ['Record BPG', '0119d2e6-e2e1-391c-9b88-d59a10b0780d'],
    ['Record oral', 'ba29e982-ce18-302a-9fc4-d4b2c3983465'],
  ])('%s opens that form in a visit', async (action, formUuid) => {
    respondWith(winnie);

    renderCard();

    await userEvent.click(await screen.findByRole('button', { name: new RegExp(`^${action}`) }));
    expect(openForm).toHaveBeenCalledWith(formUuid);
  });

  it('asks for the summary again when a form save invalidates the patient encounters', async () => {
    respondWith(winnie);
    renderCard();
    await screen.findByText('BPG · every 4 weeks');
    expect(field('next-due')).toHaveAttribute('data-overdue', 'true');

    respondWith({ ...winnie, lastGiven: '2026-10-02', nextDue: '2026-10-30', status: 'ok' });
    await invalidatePatientEncounters('winnie');

    await waitFor(() => expect(field('last-dose')).toHaveTextContent('02-Oct-2026'));
    expect(field('next-due')).toHaveAttribute('data-overdue', 'false');
    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(2);
  });

  it('does not ask again when another patient encounters are invalidated', async () => {
    respondWith(winnie);
    renderCard();
    await screen.findByText('BPG · every 4 weeks');

    await invalidatePatientEncounters('someone-else');
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
  });

  it('asks for the summary once on mount', async () => {
    respondWith(winnie);

    renderCard();
    await screen.findByText('BPG · every 4 weeks');
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(mockOpenmrsFetch).toHaveBeenCalledTimes(1);
  });

  it('disables the Record actions while a form is being opened', async () => {
    respondWith(winnie);
    vi.mocked(useOpenFormInVisit).mockReturnValue({ open: openForm, isOpening: true });

    renderCard();

    expect(await screen.findByRole('button', { name: /^Record BPG/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Record oral/ })).toBeDisabled();
  });

  it('shows a skeleton while the summary loads, with the Record actions ready', async () => {
    mockOpenmrsFetch.mockImplementation((() => new Promise(() => {})) as never);

    renderCard();

    expect(await screen.findByTestId('prophylaxis-loading')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Record BPG/ })).toBeEnabled();
  });
});
