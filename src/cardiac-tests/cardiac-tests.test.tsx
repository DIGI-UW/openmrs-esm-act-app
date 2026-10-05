import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ScopedMutator, SWRConfig, useSWRConfig } from 'swr';
import { ErrorState, getDefaultsFromConfigSchema, openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import { type Config, configSchema } from '../config-schema';
import { layouts, setLayout, tableSkeleton } from '../table-skeleton.test-helper';
import { useOpenFormInVisit } from '../visits/open-form-in-visit';
import CardiacTests from './cardiac-tests.component';

vi.mock('../visits/open-form-in-visit', () => ({ useOpenFormInVisit: vi.fn() }));
// The framework's test mock has no EmptyCard, the styleguide's empty state.
vi.mock('@openmrs/esm-framework', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  EmptyCard: ({
    displayText,
    headerTitle,
    launchForm,
  }: {
    displayText: string;
    headerTitle: string;
    launchForm?: () => void;
  }) => (
    <div data-testid="empty-card">
      {`${headerTitle}: no ${displayText}`}
      {launchForm && <button onClick={launchForm}>Record {displayText}</button>}
    </div>
  ),
}));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const openForm = vi.fn();

const [date, mr, ms, ar, as, lvef] = [
  '911be530-9457-54be-8515-4bbcdb832ccb',
  'd6ab05e2-1ece-5f8f-893d-74739aa66ce5',
  'ed209fc3-0138-516c-a0bd-bcd3b2697a87',
  '0bbc510f-1e95-5c74-bbe3-8896907fd6c1',
  '7586c9a6-73db-5ab2-8f23-71a3cc4bae62',
  'ed630fda-8451-53c0-929e-40eafd9bca9b',
];
const answer = (display: string) => ({ display });
const obs = (concept: string, value: unknown) => ({ concept: { uuid: concept }, value });

// Shaped as the distro's REST answers the page's echocardiogram search: coded answers by display, the date as a day.
const echoes = [
  {
    uuid: 'older',
    encounterDatetime: '2026-09-30T10:00:00.000+0000',
    obs: [
      obs(date, '2025-09-02'),
      obs(mr, answer('None')),
      obs(ms, answer('Mild')),
      obs(ar, answer('Mild')),
      obs(as, answer('Mild')),
      obs(lvef, 55),
    ],
  },
  {
    uuid: 'newer',
    encounterDatetime: '2026-03-01T10:00:00.000+0000',
    obs: [obs(date, '2026-02-27'), obs(mr, answer('Moderate')), obs(lvef, 48)],
  },
];

const ecgEncounterType = '64c3f35f-a3ec-59d6-8178-0ca9f068cda8';

/** Answers the echocardiogram search with results, and the electrocardiogram search with ecgs. */
function respondWith(results: Array<object> | Error, ecgs: Array<object> = []) {
  mockOpenmrsFetch.mockImplementation(((url: string) => {
    const answer = url.includes(ecgEncounterType) ? ecgs : results;
    return answer instanceof Error
      ? Promise.reject(answer)
      : Promise.resolve({ data: { results: answer, totalCount: answer.length } });
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
      <CardiacTests patientUuid="winnie" />
    </SWRConfig>,
  );
}

function shownRows() {
  return screen
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    );
}

describe('CardiacTests', () => {
  beforeEach(() => {
    vi.mocked(useConfig<Config>).mockReturnValue(getDefaultsFromConfigSchema(configSchema) as Config);
    vi.mocked(useOpenFormInVisit).mockReturnValue({ open: openForm, isOpening: false });
    setLayout('small-desktop');
    respondWith(echoes);
  });

  it("lists the patient's echocardiograms newest first, by their echo date, with the valve findings and ejection fraction", async () => {
    renderPage();

    await screen.findByText('55%');
    expect(screen.getByText('Echocardiograms')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      '',
      'Date',
      'Mitral regurgitation',
      'Mitral stenosis',
      'Aortic regurgitation',
      'Aortic stenosis',
      'Left ventricular ejection fraction',
    ]);
    expect(shownRows()).toEqual([
      ['', '27-Feb-2026', 'Moderate', '--', '--', '--', '48%'],
      ['', '02-Sept-2025', 'None', 'Mild', 'Mild', 'Mild', '55%'],
    ]);
  });

  it("searches the patient's encounters of the echo form's encounter type", async () => {
    renderPage();

    await screen.findByText('55%');
    const url = mockOpenmrsFetch.mock.calls
      .map(([called]) => String(called))
      .find((called) => called.includes('730f5ec2'));
    expect(url).toContain(`${restBaseUrl}/encounter?patient=winnie&`);
    expect(url).toContain('encounterType=730f5ec2-7102-55d0-8602-2d792844f245');
  });

  it('dates an echocardiogram without an echo date by its encounter', async () => {
    respondWith([{ ...echoes[1], obs: [obs(lvef, 48)] }]);

    renderPage();

    expect(await screen.findByText('01-Mar-2026')).toBeInTheDocument();
  });

  it('shows an echocardiogram saved in the chart once the forms app revalidates the patient encounters', async () => {
    renderPage();
    await screen.findByText('55%');
    respondWith([
      { uuid: 'today', encounterDatetime: '2026-10-02T08:00:00.000+0000', obs: [obs(lvef, 61)] },
      ...echoes,
    ]);

    // The chart's invalidatePatientEncounters, which the forms app runs after every save.
    await mutateCache(
      (key) => typeof key === 'string' && key.includes(`${restBaseUrl}/encounter`) && key.includes('patient=winnie'),
    );

    expect(await screen.findByText('61%')).toBeInTheDocument();
  });

  it('opens the echocardiogram form from Add through the hook that starts a visit when needed', async () => {
    renderPage();
    await screen.findByText('55%');

    await userEvent.click(screen.getByRole('button', { name: /^Add/ }));

    expect(useOpenFormInVisit).toHaveBeenCalledWith('winnie');
    expect(openForm).toHaveBeenCalledWith('88e54fb0-1243-3f7a-b925-f64648ca6635');
  });

  it.each(layouts)('shows a table skeleton sized for a $layout while they load', async ({ layout, compact }) => {
    setLayout(layout);
    // The echocardiograms still loading; the electrocardiograms already answered with none.
    mockOpenmrsFetch.mockImplementation(((url: string) =>
      url.includes(ecgEncounterType)
        ? Promise.resolve({ data: { results: [], totalCount: 0 } })
        : new Promise(() => undefined)) as never);

    renderPage();

    await waitFor(() => expect(screen.getAllByRole('progressbar')).toHaveLength(1));
    const { skeleton, columns } = tableSkeleton();
    expect(skeleton.className.includes('cds--data-table--compact')).toBe(compact);
    expect(columns).toBe(6);
  });

  it.each(layouts)('lists them in a $size table on $layout', async ({ layout, size }) => {
    setLayout(layout);

    renderPage();

    await screen.findByText('55%');
    expect(screen.getByRole('table')).toHaveClass(`cds--data-table--${size}`);
  });

  it('says so when the patient has no echocardiogram, offering to record one', async () => {
    respondWith([]);

    renderPage();

    await screen.findByText('Echocardiograms: no echocardiograms', { exact: false });
    await userEvent.click(screen.getByRole('button', { name: 'Record echocardiograms' }));
    expect(openForm).toHaveBeenCalledWith('88e54fb0-1243-3f7a-b925-f64648ca6635');
  });

  it('says so when the echocardiograms cannot be loaded', async () => {
    const forbidden = new Error('Forbidden');
    respondWith(forbidden);

    renderPage();

    await waitFor(() =>
      expect(vi.mocked(ErrorState).mock.calls.map(([props]) => props)).toContainEqual({
        error: forbidden,
        headerTitle: 'Echocardiograms',
      }),
    );
  });
  it("opens an echocardiogram's row on the findings the table has no column for", async () => {
    respondWith([
      {
        ...echoes[0],
        obs: [
          ...echoes[0].obs,
          { concept: { uuid: 'tr', display: 'Tricuspid Regurgitation' }, value: answer('Moderate') },
          { concept: { uuid: 'wilkins', display: 'Wilkins Score' }, value: 8 },
        ],
      },
    ]);
    renderPage();
    await screen.findByText('55%');

    await userEvent.click(screen.getByRole('button', { name: 'Other findings' }));

    const findings = screen.getByTestId('other-findings');
    expect(
      within(findings)
        .getAllByRole('term')
        .map((term) => term.textContent),
    ).toEqual(['Tricuspid Regurgitation', 'Wilkins Score']);
    expect(
      within(findings)
        .getAllByRole('definition')
        .map((value) => value.textContent),
    ).toEqual(['Moderate', '8']);
  });

  it("lists the patient's electrocardiograms newest first, with each result finding", async () => {
    const [ecgDate, result, other] = [
      'a85d4e63-500f-5af9-8ebd-9e1db5ddc3ed',
      '1c5476e4-ff12-5fbd-b2ad-53f66f9006a0',
      '67d65827-eea5-57ac-ae8b-77f91d128063',
    ];
    respondWith(echoes, [
      {
        uuid: 'ecg-old',
        encounterDatetime: '2025-01-10T10:00:00.000+0000',
        obs: [obs(ecgDate, '2025-01-09'), obs(result, answer('Normal'))],
      },
      {
        uuid: 'ecg-new',
        encounterDatetime: '2026-05-10T10:00:00.000+0000',
        obs: [obs(result, answer('Atrial fibrillation')), obs(result, answer('LVH')), obs(other, 'Long QT')],
      },
    ]);
    renderPage();

    const table = await screen.findByRole('table', { name: 'Electrocardiograms' });
    expect(
      within(table)
        .getAllByRole('row')
        .slice(1)
        .map((row) =>
          within(row)
            .getAllByRole('cell')
            .map((cell) => cell.textContent),
        ),
    ).toEqual([
      ['10-May-2026', 'Atrial fibrillation, LVH', 'Long QT'],
      ['09-Jan-2025', 'Normal', '--'],
    ]);
  });

  it('opens the electrocardiogram form from its empty card', async () => {
    renderPage();
    await screen.findByText('55%');

    await userEvent.click(await screen.findByRole('button', { name: 'Record electrocardiograms' }));

    expect(openForm).toHaveBeenCalledWith('3776bb8d-4741-3741-aeef-d5b760443569');
  });
});
