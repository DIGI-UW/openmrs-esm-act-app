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

// The card also reads the next steps, for a held BPG; these count the summary's own requests.
const summaryRequests = () =>
  mockOpenmrsFetch.mock.calls.filter(([url]) => String(url).includes('/actcore/prophylaxis')).length;

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
    // ACT Core dates an oral regimen by its latest report and when that report's supply runs out.
    expect(screen.getByText('Last report')).toBeInTheDocument();
    expect(screen.getByText('Next refill')).toBeInTheDocument();
    await waitFor(() => expect(field('on-time')).toHaveTextContent('70%'));
  });

  it("shows a back-entered report's adherence, as ACT Core takes the latest report by encounter date", async () => {
    const defaults = getDefaultsFromConfigSchema(configSchema) as Config;
    const { adherence, estimateDate } = defaults.prophylaxisPage.concepts;
    vi.mocked(useConfig<Config>).mockReturnValue(defaults);
    const report = (entered: string, estimated: string, value: number) => ({
      uuid: entered,
      encounterDatetime: entered,
      obs: [
        { concept: { uuid: estimateDate }, value: estimated },
        { concept: { uuid: adherence }, value },
      ],
    });
    mockOpenmrsFetch.mockImplementation(((url: string) =>
      Promise.resolve({
        data: url.includes('/actcore/prophylaxis')
          ? { ...winnie, type: 'Oral', regimen: null, intervalDays: 0, onTime: null, status: 'ok' }
          : {
              results: [report('2026-09-01', '2026-09-01', 90), report('2026-09-20', '2026-08-15', 60)],
              totalCount: 2,
            },
      })) as never);

    renderCard();

    await waitFor(() => expect(field('on-time')).toHaveTextContent('60%'));
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
      '/openmrs/spa/patient/winnie/chart/act-prophylaxis',
    );
  });

  it('links to the Prophylaxis page when the distro puts it in a dashboard group', async () => {
    navHas([{ name: 'act-group', meta: {}, config: { slotName: 'act-group-slot' } }], { 'act-group-slot': [pageLink] });
    respondWith(winnie);
    renderCard();

    expect(await screen.findByRole('link', { name: 'History' })).toHaveAttribute(
      'href',
      '/openmrs/spa/patient/winnie/chart/act-prophylaxis',
    );
  });

  it("links to the path the distro's config gives the Prophylaxis page", async () => {
    navHas([{ ...pageLink, config: { path: 'bpg-history' } }]);
    respondWith(winnie);
    renderCard();

    expect(await screen.findByRole('link', { name: 'History' })).toHaveAttribute(
      'href',
      '/openmrs/spa/patient/winnie/chart/bpg-history',
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
    respondWith({ ...winnie, type: null });

    renderCard();

    await userEvent.click(await screen.findByRole('button', { name: new RegExp(`^${action}`) }));
    expect(openForm).toHaveBeenCalledWith(formUuid);
  });

  it.each([
    ['BPG', 'Record BPG'],
    ['Oral', 'Record oral'],
  ])('offers only the form for a %s prescription', async (type, action) => {
    respondWith({ ...winnie, type });

    renderCard();

    await waitFor(() => expect(screen.getAllByRole('button')).toHaveLength(1));
    expect(screen.getByRole('button', { name: new RegExp(`^${action}`) })).toBeInTheDocument();
  });

  it.each(['BPG', 'Oral'])('offers a clinician both forms for a %s prescription, to change the regimen', async (type) => {
    await signInWith(['Add Encounters', 'Task: act.enterClinicalForms']);
    respondWith({ ...winnie, type });

    renderCard();

    expect(await screen.findByRole('button', { name: /^Record BPG/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Record oral/ })).toBeInTheDocument();
  });

  it('says Needs prescription instead of offering a form to a patient with no prescription in force', async () => {
    respondWith({ ...winnie, type: null, regimen: null, intervalDays: null, status: 'none' });

    renderCard();

    await screen.findByText('No prescription');
    expect(screen.getByTestId('needs-prescription')).toHaveTextContent('Needs prescription');
    expect(screen.queryByRole('button', { name: /^Record BPG/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Record oral/ })).not.toBeInTheDocument();
  });

  it('shows BPG on hold instead of Record BPG while ACT Core holds the BPG step', async () => {
    const reason = 'On hold: a clinician must review before the next dose';
    mockOpenmrsFetch.mockImplementation(((url: string) =>
      Promise.resolve({
        data: url.includes('nextsteps')
          ? {
              steps: [
                {
                  key: 'refer',
                  form: null,
                  title: 'Refer to clinician',
                  reason: 'Anaphylaxis',
                  isNew: true,
                  done: false,
                },
                {
                  key: 'bpg',
                  form: null,
                  title: 'Give BPG injection',
                  reason,
                  isNew: false,
                  done: false,
                  onHold: true,
                },
              ],
            }
          : winnie,
      })) as never);

    renderCard();

    expect(await screen.findByTestId('bpg-on-hold')).toHaveTextContent('BPG on hold');
    expect(screen.getByTestId('bpg-on-hold')).toHaveAttribute('title', reason);
    expect(screen.queryByRole('button', { name: /^Record BPG/ })).not.toBeInTheDocument();
  });

  it('offers Record BPG while the BPG step is due but not on hold', async () => {
    mockOpenmrsFetch.mockImplementation(((url: string) =>
      Promise.resolve({
        data: url.includes('nextsteps')
          ? {
              steps: [
                {
                  key: 'bpg',
                  form: 'bpg-form-uuid',
                  title: 'Give BPG injection',
                  reason: 'Due',
                  isNew: false,
                  done: false,
                  onHold: false,
                },
              ],
            }
          : winnie,
      })) as never);

    renderCard();

    await screen.findByText('BPG · every 4 weeks');
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(screen.getByRole('button', { name: /^Record BPG/ })).toBeInTheDocument();
    expect(screen.queryByTestId('bpg-on-hold')).not.toBeInTheDocument();
  });

  it('keeps Record oral while a BPG step is on hold, as the hold is on injections', async () => {
    mockOpenmrsFetch.mockImplementation(((url: string) =>
      Promise.resolve({
        data: url.includes('nextsteps')
          ? {
              steps: [
                {
                  key: 'bpg',
                  form: null,
                  title: 'Give BPG injection',
                  reason: 'On hold',
                  isNew: false,
                  done: false,
                  onHold: true,
                },
              ],
            }
          : { ...winnie, type: 'Oral', regimen: 'Oral penicillin V', intervalDays: 0, onTime: null },
      })) as never);

    renderCard();

    expect(await screen.findByRole('button', { name: /^Record oral/ })).toBeInTheDocument();
    expect(screen.queryByTestId('bpg-on-hold')).not.toBeInTheDocument();
  });

  it('does not ask for the next steps when nextSteps.enabled is false', async () => {
    const defaults = getDefaultsFromConfigSchema(configSchema) as Config;
    vi.mocked(useConfig<Config>).mockReturnValue({ ...defaults, nextSteps: { enabled: false } });
    respondWith(winnie);

    renderCard();
    await screen.findByText('BPG · every 4 weeks');
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(mockOpenmrsFetch.mock.calls.map(([url]) => String(url))).not.toContainEqual(
      expect.stringContaining('/actcore/nextsteps'),
    );
    expect(screen.getByRole('button', { name: /^Record BPG/ })).toBeInTheDocument();
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
    expect(summaryRequests()).toBe(2);
  });

  it('does not ask again when another patient encounters are invalidated', async () => {
    respondWith(winnie);
    renderCard();
    await screen.findByText('BPG · every 4 weeks');

    await invalidatePatientEncounters('someone-else');
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(summaryRequests()).toBe(1);
  });

  it('asks for the summary once on mount', async () => {
    respondWith(winnie);

    renderCard();
    await screen.findByText('BPG · every 4 weeks');
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(summaryRequests()).toBe(1);
  });

  it('disables the Record actions while a form is being opened', async () => {
    respondWith({ ...winnie, type: null });
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
    expect(screen.getByRole('button', { name: /^Record oral/ })).toBeEnabled();
  });
});
