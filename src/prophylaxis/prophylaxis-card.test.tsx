import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signInWith } from '../access/sign-in.test-helper';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ScopedMutator, SWRConfig, useSWRConfig } from 'swr';
import {
  type AssignedExtension,
  getAssignedExtensions,
  getDefaultsFromConfigSchema,
  openmrsFetch,
  restBaseUrl,
  useAssignedExtensions,
  useConfig,
} from '@openmrs/esm-framework';
import { type Config, configSchema } from '../config-schema';
import { useOpenFormInVisit } from '../visits/open-form-in-visit';
import ProphylaxisCard from './prophylaxis-card.component';

// Who may record a form is may-enter-form's own test; here every form may be recorded.
vi.mock('../access/may-enter-form', () => ({
  MayEnterForm: ({ children }: { children: React.ReactNode }) => children,
  useMayEnterForm: () => true,
}));
vi.mock('../visits/open-form-in-visit', () => ({ useOpenFormInVisit: vi.fn() }));
// The framework's test mock has no getAssignedExtensions, which reads a dashboard group's slot.
vi.mock('@openmrs/esm-framework', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getAssignedExtensions: vi.fn(() => []),
}));

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

const pageLink = {
  name: 'act-prophylaxis-dashboard-link',
  meta: { slot: 'act-prophylaxis-dashboard-slot', path: 'act-prophylaxis' },
  config: {},
} as unknown as AssignedExtension;

function navHas(links: Array<object>, groups: Record<string, Array<object>> = {}) {
  vi.mocked(useAssignedExtensions).mockReturnValue(links as Array<AssignedExtension>);
  vi.mocked(getAssignedExtensions).mockImplementation((slot) => (groups[slot] ?? []) as Array<AssignedExtension>);
}

const field = (name: string) => screen.getByTestId(`prophylaxis-${name}`);

describe('ProphylaxisCard', () => {
  beforeEach(async () => {
    await signInWith(['Add Encounters']);
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    navHas([pageLink]);
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

  it("names an oral regimen and shows the latest Oral Adherence report's adherence", async () => {
    const adherence = '3b4d1b4c-3b2a-5b5c-9a3c-0c8c4c5c6c7c';
    vi.mocked(useConfig<Config>).mockReturnValue({
      ...(getDefaultsFromConfigSchema(configSchema) as Config),
      prophylaxisPage: {
        ...(getDefaultsFromConfigSchema(configSchema) as Config).prophylaxisPage,
        concepts: {
          ...(getDefaultsFromConfigSchema(configSchema) as Config).prophylaxisPage.concepts,
          adherence,
        },
      },
    });
    const report = (date: string, value: number | null) => ({
      uuid: date,
      encounterDatetime: date,
      obs: value == null ? [] : [{ concept: { uuid: adherence }, value }],
    });
    mockOpenmrsFetch.mockImplementation(((url: string) =>
      Promise.resolve({
        data: url.includes('/actcore/prophylaxis')
          ? { ...winnie, type: 'Oral', regimen: 'Oral penicillin V', intervalDays: 0, onTime: null, status: 'ok' }
          : {
              results: [report('2026-08-01', 85), report('2026-09-01', 70), report('2026-09-20', null)],
              totalCount: 3,
            },
      })) as never);

    renderCard();

    expect(await screen.findByText('Oral penicillin V')).toBeInTheDocument();
    expect(screen.getByText('Adherence (last report)')).toBeInTheDocument();
    await waitFor(() => expect(field('on-time')).toHaveTextContent('70%'));
  });

  it('says -- for an oral regimen with no adherence reported', async () => {
    mockOpenmrsFetch.mockImplementation(((url: string) =>
      Promise.resolve({
        data: url.includes('/actcore/prophylaxis')
          ? { ...winnie, type: 'Oral', regimen: null, intervalDays: 0, onTime: null, status: 'ok' }
          : { results: [], totalCount: 0 },
      })) as never);

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

  it("links to the chart's Prophylaxis page, which lists every injection and oral report", async () => {
    respondWith(winnie);
    renderCard();

    expect(await screen.findByRole('link', { name: 'History' })).toHaveAttribute(
      'href',
      expect.stringContaining('/patient/winnie/chart/act-prophylaxis'),
    );
  });

  it('links to the Prophylaxis page when the distro puts it in a dashboard group', async () => {
    navHas([{ name: 'act-group', meta: {}, config: { slotName: 'act-group-slot' } }], { 'act-group-slot': [pageLink] });
    respondWith(winnie);
    renderCard();

    expect(await screen.findByRole('link', { name: 'History' })).toHaveAttribute(
      'href',
      expect.stringContaining('/patient/winnie/chart/act-prophylaxis'),
    );
  });

  it("links to the path the distro's config gives the Prophylaxis page", async () => {
    navHas([{ ...pageLink, config: { path: 'bpg-history' } }]);
    respondWith(winnie);
    renderCard();

    expect(await screen.findByRole('link', { name: 'History' })).toHaveAttribute(
      'href',
      expect.stringContaining('/patient/winnie/chart/bpg-history'),
    );
  });

  it("has no History link when the chart's nav has no Prophylaxis page", async () => {
    navHas([{ name: 'act-cardiac-tests-dashboard-link', meta: { path: 'act-cardiac-tests' }, config: {} }]);
    respondWith(winnie);
    renderCard();

    await screen.findByText('BPG · every 4 weeks');
    expect(screen.queryByRole('link', { name: 'History' })).not.toBeInTheDocument();
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

    // A past date, as the framework writes the day the test runs as Today.
    respondWith({ ...winnie, lastGiven: '2026-09-28', nextDue: '2026-10-26', status: 'ok' });
    await invalidatePatientEncounters('winnie');

    await waitFor(() => expect(field('last-dose')).toHaveTextContent(/^28-Sept?-2026$/));
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
