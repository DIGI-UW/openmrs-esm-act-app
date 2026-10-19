import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signInWith } from '../access/sign-in.test-helper';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ScopedMutator, SWRConfig, useSWRConfig } from 'swr';
import { ErrorState, getDefaultsFromConfigSchema, openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import { type Config, configSchema } from '../config-schema';
import { layouts, setLayout, tableSkeleton } from '../table-skeleton.test-helper';
import { useOpenFormInVisit } from '../visits/open-form-in-visit';
import ProphylaxisPage from './prophylaxis-page.component';

vi.mock('../visits/open-form-in-visit', () => ({ useOpenFormInVisit: vi.fn() }));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const openForm = vi.fn();

const [injectionDate, dose, facility, lateReason, estimateDate, adherence, basedOn, lowReason, newPrescription] = [
  '183fb30e-b861-5b7c-806f-7118a40f2b51',
  '6a52b6aa-2427-4fa2-93cb-18956f50c16a',
  '01e6dd39-b8ba-5b0a-bcd7-6b8d5973c1bc',
  'f7cbfcdc-58bb-5e85-86ab-ffce26a08615',
  '99512ab5-208e-5c37-8f7b-8f72abe2a0db',
  '8edff8dc-4af6-5d0f-bf1d-8e349c7a1b15',
  '4313005d-d5b2-5d20-bf33-39aab1bf90c0',
  'a9fbf67b-65d7-57f6-8270-7bb65cd49469',
  'cd03af00-de81-5c08-9a02-92f95c00e1ce',
];
const kiswa = { uuid: '0a1b2c3d-1111-4222-8333-444455556666', display: 'Kiswa HC III' };
const obs = (concept: string, value: unknown) => ({ concept: { uuid: concept }, value });

// Shaped as the distro's REST answers: Date as a day, Facility as the location REST resolves its uuid to, or text,
// late reasons coded.
const bpg = [
  {
    uuid: 'jul',
    encounterDatetime: '2026-07-02T09:00:00.000+0000',
    location: { display: 'Akunalaber HCIII' },
    obs: [obs(injectionDate, '2026-07-02'), obs(facility, kiswa)],
  },
  {
    uuid: 'aug',
    encounterDatetime: '2026-08-03T09:00:00.000+0000',
    location: { display: 'Akunalaber HCIII' },
    obs: [
      obs(injectionDate, '2026-08-03'),
      obs(dose, { uuid: '0cd38c13-17ac-48da-a946-1b21789e5027', display: '1.2 MU (1,200,000 units)' }),
      obs(lateReason, { uuid: 'transport', display: 'Could not arrange transportation' }),
      obs(lateReason, { uuid: 'forgot', display: 'Forgot to come' }),
    ],
  },
  {
    uuid: 'sep',
    encounterDatetime: '2026-08-31T09:00:00.000+0000',
    location: null,
    obs: [obs(injectionDate, '2026-08-31'), obs(facility, 'Kiswa HC III (ACT 2.0)')],
  },
];
// Shaped as the distro saves the Oral Adherence form: the estimate dated on the form, its answers coded.
const oral = [
  {
    uuid: 'oral-1',
    encounterDatetime: '2026-05-12T09:00:00.000+0000',
    location: null,
    obs: [
      obs(estimateDate, '2026-05-10T00:00:00.000+0000'),
      obs(adherence, 85),
      // Based on is a checkbox question since distro #137: one obs per answer ticked.
      obs(basedOn, { uuid: 'calendar', display: 'Calendar' }),
      obs(basedOn, { uuid: 'pill-count', display: 'Pill count' }),
      obs(newPrescription, { uuid: 'three-months', display: '3 months' }),
    ],
  },
  {
    uuid: 'oral-2',
    encounterDatetime: '2026-08-10T09:00:00.000+0000',
    location: null,
    obs: [
      obs(adherence, 65),
      obs(lowReason, { uuid: 'afford', display: 'Could not afford medication' }),
      obs(newPrescription, { uuid: 'one-month', display: '1 month' }),
    ],
  },
];
const timing = [
  { date: '2026-08-31', onTime: true },
  { date: '2026-08-03', onTime: false },
  { date: '2026-07-02', onTime: null },
];

function serve({
  injections = bpg,
  oralEntries = [] as Array<object>,
  failEncounters = false,
  failOral = false,
  summary = { type: 'BPG', injections: timing } as object | Error,
} = {}) {
  mockOpenmrsFetch.mockImplementation(((url: string) => {
    if (url.includes('/actcore/prophylaxis')) {
      return summary instanceof Error ? Promise.reject(summary) : Promise.resolve({ data: summary });
    }
    if (failEncounters || (failOral && url.includes('encounterType=55271793'))) {
      return Promise.reject(new Error('Forbidden'));
    }
    const results = url.includes('encounterType=04cf03db') ? injections : oralEntries;
    return Promise.resolve({ data: { results, totalCount: results.length } });
  }) as never);
}

let mutateCache: ScopedMutator;

function CacheMutator() {
  mutateCache = useSWRConfig().mutate;
  return null;
}

function renderPage() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
      <CacheMutator />
      <ProphylaxisPage patientUuid="winnie" />
    </SWRConfig>,
  );
}

function rows(table: HTMLElement) {
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    );
}

describe('ProphylaxisPage', () => {
  beforeEach(async () => {
    await signInWith(['Add Encounters']);
    vi.mocked(useOpenFormInVisit).mockReturnValue({ open: openForm, isOpening: false });
    setLayout('small-desktop');
    serve();
  });

  it("lists the patient's BPG injections newest first, with the dose given, their facility and ACT Core's timing", async () => {
    renderPage();

    const table = await screen.findByRole('table', { name: 'BPG injections' });
    await waitFor(() => expect(within(table).getByText('Kiswa HC III')).toBeInTheDocument());
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Date', 'Given', 'Facility', 'Notes']);
    expect(rows(table)).toEqual([
      ['31-Aug-2026', '--', 'Kiswa HC III (ACT 2.0)', 'On time'],
      [
        '03-Aug-2026',
        '1.2 MU (1,200,000 units)',
        'Akunalaber HCIII',
        'Late · Could not arrange transportation, Forgot to come',
      ],
      ['02-Jul-2026', '--', 'Kiswa HC III', ''],
    ]);
  });

  it('names the facility REST resolves a location answer to, with no lookup of its own', async () => {
    renderPage();

    const table = await screen.findByRole('table', { name: 'BPG injections' });
    expect(within(table).getByText('Kiswa HC III')).toBeInTheDocument();
    expect(mockOpenmrsFetch.mock.calls.filter(([url]) => String(url).includes('/location/'))).toHaveLength(0);
  });

  it('marks an on time injection green and a late one as late', async () => {
    renderPage();

    await screen.findByText('On time');
    const [onTime, late] = screen.getAllByTestId('timing-tag');
    expect(onTime).toHaveClass('cds--tag--green');
    expect(late).toHaveAttribute('data-late', 'true');
  });

  it.each([
    ['an ACT Core that predates timings', { type: 'BPG' }],
    ['an ACT Core that cannot be reached', new Error('Not found')],
  ])('lists the injections without timing for %s', async (_, summary) => {
    serve({ summary });

    renderPage();

    const table = await screen.findByRole('table', { name: 'BPG injections' });
    await waitFor(() => expect(within(table).getByText('Kiswa HC III')).toBeInTheDocument());
    expect(rows(table).map((row) => row[3])).toEqual(['', '', '']);
    expect(ErrorState).not.toHaveBeenCalled();
  });

  it('leaves out a BPG visit with no Date of Injection, as the form records none when BPG is withheld', async () => {
    serve({
      injections: [
        bpg[0],
        { uuid: 'withheld', encounterDatetime: '2026-09-01T09:00:00.000+0000', location: null, obs: [] },
      ],
    });

    renderPage();

    const table = await screen.findByRole('table', { name: 'BPG injections' });
    expect(rows(table).map((row) => row[0])).toEqual(['02-Jul-2026']);
  });

  it("shows each oral adherence report's answers newest first, dated by the form when it gives a date", async () => {
    serve({ oralEntries: oral });

    renderPage();

    const table = await screen.findByRole('table', { name: 'Oral adherence' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Date', 'Adherence', 'Based on', 'Reason if below 80%', 'New prescription']);
    expect(rows(table)).toEqual([
      ['10-Aug-2026', '65%', '--', 'Could not afford medication', '1 month'],
      ['10-May-2026', '85%', 'Calendar, Pill count', '--', '3 months'],
    ]);
    expect(within(table).getByTestId('low-adherence')).toHaveTextContent('65%');
  });

  describe('for a patient on oral prophylaxis', () => {
    beforeEach(() => serve({ summary: { type: 'Oral' }, injections: [], oralEntries: oral }));

    it('leads with the oral reports and offers only Record oral', async () => {
      renderPage();

      await screen.findByRole('table', { name: 'Oral adherence' });
      await waitFor(() => expect(screen.getAllByRole('button')).toHaveLength(1));
      expect(screen.getByRole('button', { name: /^Record oral/ })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'BPG injections' })).not.toBeInTheDocument();
    });

    it('still lists BPG injections given before the switch to oral, without their Record action', async () => {
      serve({ summary: { type: 'Oral' }, oralEntries: oral });

      renderPage();

      expect(await screen.findByRole('table', { name: 'BPG injections' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Record BPG/ })).not.toBeInTheDocument();
    });

    it('says so when no oral report has been entered yet', async () => {
      serve({ summary: { type: 'Oral' }, injections: [] });

      renderPage();

      expect(await screen.findByTestId('table-empty-state')).toHaveTextContent(
        'There are no oral adherence reports to display',
      );
      expect(screen.getByRole('button', { name: /^Record oral/ })).toBeInTheDocument();
    });
  });

  it('says so when the oral adherence entries cannot be loaded, rather than leaving them out', async () => {
    serve({ failOral: true });

    renderPage();

    await screen.findByRole('table', { name: 'BPG injections' });
    await waitFor(() =>
      expect(vi.mocked(ErrorState).mock.calls.map(([props]) => props.headerTitle)).toContain('Oral adherence'),
    );
  });

  it('leaves the oral adherence table out for a patient with none', async () => {
    renderPage();

    await screen.findByRole('table', { name: 'BPG injections' });
    expect(screen.queryByRole('table', { name: 'Oral adherence' })).not.toBeInTheDocument();
  });

  it.each([
    ['Record BPG', 'BPG', '0119d2e6-e2e1-391c-9b88-d59a10b0780d'],
    ['Record oral', 'Oral', 'ba29e982-ce18-302a-9fc4-d4b2c3983465'],
  ])('opens the form from %s through the hook that starts a visit when needed', async (label, type, form) => {
    serve({ summary: { type }, oralEntries: oral });
    renderPage();
    await screen.findByRole('button', { name: new RegExp(`^${label}`) });

    await userEvent.click(screen.getByRole('button', { name: new RegExp(`^${label}`) }));

    expect(useOpenFormInVisit).toHaveBeenCalledWith('winnie');
    expect(openForm).toHaveBeenCalledWith(form);
  });

  it('shows an injection saved in the chart once the forms app revalidates the patient encounters', async () => {
    renderPage();
    const table = await screen.findByRole('table', { name: 'BPG injections' });
    serve({
      injections: [
        ...bpg,
        {
          uuid: 'oct',
          encounterDatetime: '2026-10-02T09:00:00.000+0000',
          location: null,
          obs: [obs(injectionDate, '2026-10-02')],
        },
      ],
    });

    // The chart's invalidatePatientEncounters, which the forms app runs after every save.
    await mutateCache(
      (key) => typeof key === 'string' && key.includes(`${restBaseUrl}/encounter`) && key.includes('patient=winnie'),
    );

    expect(await within(table).findByText('02-Oct-2026')).toBeInTheDocument();
  });

  it.each(layouts)('shows a table skeleton sized for a $layout while the injections load', ({ layout, compact }) => {
    setLayout(layout);
    mockOpenmrsFetch.mockImplementation((() => new Promise(() => undefined)) as never);

    renderPage();

    const { skeleton, columns } = tableSkeleton();
    expect(skeleton.className.includes('cds--data-table--compact')).toBe(compact);
    expect(columns).toBe(4);
  });

  it('offers only Record BPG to a patient on BPG', async () => {
    renderPage();

    await screen.findByRole('table', { name: 'BPG injections' });
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Record oral/ })).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: /^Record BPG/ })).toBeInTheDocument();
  });

  it('says so when a patient with no prescription has no BPG injection, offering both forms', async () => {
    serve({ injections: [], summary: { type: null } });

    renderPage();

    expect(await screen.findByTestId('table-empty-state')).toHaveTextContent('There are no BPG injections to display');
    expect(screen.getByRole('button', { name: /^Record BPG/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Record oral/ })).toBeInTheDocument();
  });

  it('says so when the injections cannot be loaded', async () => {
    serve({ failEncounters: true });

    renderPage();

    await waitFor(() =>
      expect(vi.mocked(ErrorState).mock.calls.map(([props]) => props.headerTitle)).toContain('BPG injections'),
    );
    expect(screen.queryByRole('heading', { name: 'BPG injections' })).not.toBeInTheDocument();
  });
});
