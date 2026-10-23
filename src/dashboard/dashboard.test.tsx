import React from 'react';
import dayjs from 'dayjs';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DonutChart, SimpleBarChart, StackedBarChart } from '@carbon/charts-react';
import { openmrsFetch, useLayoutType, useSession } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { useReportDataset } from '../reports/report-dataset.resource';
import Dashboard from './dashboard.component';

vi.mock('../reports/report-dataset.resource', () => ({ useReportDataset: vi.fn() }));

// Carbon charts draw into an SVG the test DOM cannot lay out, so each only records its props.
vi.mock('@carbon/charts-react', async () => ({
  ...(await vi.importActual<object>('@carbon/charts-react')),
  DonutChart: vi.fn(() => null),
  SimpleBarChart: vi.fn(() => null),
  StackedBarChart: vi.fn(() => null),
}));

const REGISTRY = 'f1a2b3c4-d5e6-7890-abcd-ef1234567890';
const CARE_CASCADE = '9c6751ae-65fc-5f25-9aa6-8c65cb1dff68';
const WAITLIST = '5b0f1c2e-9d3a-4c1b-8f6e-2a7d9e4b3c10';
const OPTIMISATION = '733a512c-3243-4e91-a44a-06a8e5384606';
const SCREENING = '8b257a0c-7e96-5a01-9672-975cae3b0419';
const DIAGNOSES = '6ddf6b36-2789-4733-8433-a877d54795cf';

const today = dayjs().format('YYYY-MM-DD');

const registrant = (overrides: Record<string, unknown>) => ({
  enrollment_status: 'Active',
  deceased: 0,
  sex: 'F',
  age_years: 14,
  diagnosis_category: 'Rheumatic Heart Disease/Rheumatic Fever',
  diagnosis_details: 'RHD B',
  cardiac_clinic: 'Gulu RRH',
  primary_care_clinic: 'Acimi HCIII',
  ...overrides,
});

const recommendation = (patient: string, procedure: string, urgency: string, cardiac = 'Gulu RRH') => ({
  patient_uuid: patient,
  procedure_name: procedure,
  urgency,
  cardiac_clinic: cardiac,
  primary_care_clinic: 'Acimi HCIII',
});

const EMERGENT = '1: emergent (24 hours)';
const URGENT = '2: urgent (60 days/2 months)';

/** The count reports' rows as the server returns them: every step or measure, whatever its count. */
const countRows = (zero: boolean): Record<string, Array<Record<string, unknown>>> => {
  const n = (count: number) => (zero ? 0 : count);
  return {
    [CARE_CASCADE]: [
      { step: 'Active', patients: n(4) },
      { step: 'Prescribed', patients: n(3) },
      { step: 'Oral', patients: n(1) },
      { step: 'BPG', patients: n(2) },
      { step: 'Initiated', patients: n(2) },
      { step: 'Covered today', patients: n(2) },
      { step: 'Adherent (80%+)', patients: n(1) },
    ],
    [OPTIMISATION]: [
      { measure: 'consultations', done: n(12), not_done: null },
      { measure: 'echocardiogram', done: n(3), not_done: n(7) },
      { measure: 'retainedInCare', done: n(8), not_done: n(2) },
      { measure: 'interventionAssigned', done: n(2), not_done: n(8) },
      { measure: 'interventions', done: n(1), not_done: n(3) },
      { measure: 'warfarin', done: n(1), not_done: n(1) },
    ],
    [SCREENING]: [
      { step: 'Active', patients: n(9) },
      { step: 'Confirmatory Diagnosis', patients: n(4) },
      { step: 'Diagnosed', patients: n(4) },
      { step: 'Heart Disease', patients: n(3) },
    ],
    [DIAGNOSES]: zero
      ? []
      : [
          { breakdown: 'category', category: 'Rheumatic Heart Disease/Rheumatic Fever', details: null, patients: 3 },
          { breakdown: 'category', category: 'Normal', details: null, patients: 1 },
          {
            breakdown: 'rhdDetails',
            category: 'Rheumatic Heart Disease/Rheumatic Fever',
            details: 'RHD A',
            patients: 2,
          },
        ],
  };
};

const listRows: Record<string, Array<Record<string, unknown>>> = {
  [REGISTRY]: [
    registrant({}),
    registrant({ sex: 'M', age_years: 30, diagnosis_details: 'RHD A' }),
    registrant({ cardiac_clinic: 'Lira RRH', primary_care_clinic: 'Akunalaber HCIII' }),
    registrant({ enrollment_status: 'Completed', current_state: 'Inactive - Death' }),
  ],
  [WAITLIST]: [
    recommendation('p1', 'Mitral valve repair/replacement', URGENT),
    recommendation('p1', 'Balloon valvuloplasty', EMERGENT),
    recommendation('p2', 'Mitral valve repair/replacement', EMERGENT, 'Lira RRH'),
  ],
};

const mutates: Record<string, ReturnType<typeof vi.fn>> = {};

/**
 * Signs in, by default at a location of neither clinic kind, so the dashboard opens on every clinic, with Gulu, Lira and
 * Mbarara to choose. Mbarara and Arua have no patients, so their count reports return their rows with every count zero.
 */
async function signIn(
  failing?: string,
  overrides: Record<string, Array<Record<string, unknown>>> = {},
  sessionLocation = { uuid: 'hq', display: 'Head office', tags: [] as Array<{ display: string }> },
) {
  await signInWith(['App: act.dashboard']);
  const session = vi.mocked(useSession)();
  vi.mocked(useSession).mockReturnValue({
    ...session,
    sessionLocation: { uuid: sessionLocation.uuid, display: sessionLocation.display },
  } as never);
  vi.mocked(openmrsFetch).mockImplementation(((url: string) =>
    Promise.resolve({
      data: url.includes('/location?tag=RHD%20Tertiary')
        ? {
            results: [
              { uuid: 'gulu', display: 'Gulu RRH' },
              { uuid: 'lira', display: 'Lira RRH' },
              { uuid: 'mbarara', display: 'Mbarara RRH' },
            ],
            totalCount: 3,
          }
        : url.includes('/location?tag=')
          ? { results: [], totalCount: 0 }
          : { tags: sessionLocation.tags },
    })) as never);
  vi.mocked(useReportDataset).mockImplementation((report, params) => {
    const counts = countRows(['mbarara', 'arua'].includes(params?.cardiacClinic));
    mutates[String(report)] ??= vi.fn();
    return {
      columns: [],
      rows:
        report === failing
          ? []
          : (overrides[String(report)] ?? listRows[String(report)] ?? counts[String(report)] ?? []),
      isLoading: false,
      error: report === failing ? new Error('The server did not answer') : undefined,
      mutate: mutates[String(report)] as never,
    };
  });
}

const texts = (testId: string) => screen.getAllByTestId(testId).map((element) => element.textContent);

function chartData(chart: unknown, title: string) {
  const calls = vi.mocked(chart as typeof DonutChart).mock.calls.map(([props]) => props);
  return calls.filter((props) => props.options?.accessibility?.svgAriaLabel === title).at(-1)?.data;
}

const paramsOf = (report: string) =>
  vi
    .mocked(useReportDataset)
    .mock.calls.filter(([uuid]) => uuid === report)
    .at(-1)?.[1];

function renderPage() {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <Dashboard />
    </SWRConfig>,
  );
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.mocked(useReportDataset).mockReset();
    Object.keys(mutates).forEach((report) => delete mutates[report]);
  });

  it('shows the registered, active, prophylaxis and waiting figures as tiles', async () => {
    await signIn();

    renderPage();

    expect(await screen.findAllByTestId('dashboard-tile')).toHaveLength(4);
    expect(texts('dashboard-tile')).toEqual([
      'Registered4every status, today',
      'Active3enrolled and alive, today',
      'On secondary prophylaxis375% of active RHD',
      'Waiting for a procedure23 open recommendations',
    ]);
  });

  it('draws registrant status as a donut, printing the count and share of each status', async () => {
    await signIn();

    renderPage();

    expect(await screen.findByText('All 4 registrants, by where their registration stands today')).toBeInTheDocument();
    expect(texts('dashboard-status')).toEqual(['Active375%', 'Inactive - Death125%']);
    expect(chartData(DonutChart, 'Registrant status')).toEqual([
      { group: 'Active', value: 3 },
      { group: 'Inactive - Death', value: 1 },
    ]);
  });

  it('lists the sex, age and disease of the active registrants with the count on each row', async () => {
    await signIn();

    renderPage();

    expect(await screen.findByText('Active registrants: 3')).toBeInTheDocument();
    expect(texts('dashboard-sex')).toEqual(['Female2', 'Male1']);
    expect(texts('dashboard-age')).toEqual(['10-192', '20-391']);
    expect(texts('dashboard-category')).toEqual(['RHD B2', 'RHD A1']);
  });

  it("draws the RHD care cascade's steps as bars, printing each step's count and share of the step before", async () => {
    await signIn();

    renderPage();

    expect(await screen.findAllByTestId('dashboard-cascade-step')).toHaveLength(5);
    expect(texts('dashboard-cascade-step')).toEqual([
      'Active4',
      'Prescribed375%',
      'Initiated267%',
      'Covered today2100%',
      'Adherent (80%+)150%',
    ]);
    expect(chartData(SimpleBarChart, 'RHD care cascade')).toEqual([
      { group: 'Active', value: 4 },
      { group: 'Prescribed', value: 3 },
      { group: 'Initiated', value: 2 },
      { group: 'Covered today', value: 2 },
      { group: 'Adherent (80%+)', value: 1 },
    ]);
  });

  it('stacks the waitlist by urgency with a total on each procedure, and shows it as a table on request', async () => {
    await signIn();

    renderPage();

    expect(await screen.findByText('Procedural waitlist: 2 patients')).toBeInTheDocument();
    expect(texts('dashboard-waitlist-total')).toEqual(['Balloon valvuloplasty1', 'Mitral valve repair/replacement2']);
    expect(chartData(StackedBarChart, 'Procedural waitlist')).toEqual([
      { group: EMERGENT, key: 'Balloon valvuloplasty', value: 1 },
      { group: EMERGENT, key: 'Mitral valve repair/replacement', value: 1 },
      { group: URGENT, key: 'Mitral valve repair/replacement', value: 1 },
    ]);
    expect(screen.queryByTestId('dashboard-waitlist-row')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Show as a table' }));

    expect(
      screen.getAllByTestId('dashboard-waitlist-row').map((row) =>
        within(row)
          .getAllByRole('cell')
          .map((cell) => cell.textContent),
      ),
    ).toEqual([
      ['Balloon valvuloplasty', '1', '0'],
      ['Mitral valve repair/replacement', '1', '1'],
    ]);
  });

  it('opens the waitlist as a table on a phone, and as a chart on a tablet', async () => {
    await signIn();
    vi.mocked(useLayoutType).mockReturnValue('phone');

    const { unmount } = renderPage();

    expect(await screen.findAllByTestId('dashboard-waitlist-row')).toHaveLength(2);
    expect(screen.queryByTestId('dashboard-waitlist-total')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show as a chart' })).toBeInTheDocument();

    unmount();
    vi.mocked(useLayoutType).mockReturnValue('tablet');
    renderPage();

    expect(await screen.findAllByTestId('dashboard-waitlist-total')).toHaveLength(2);
    expect(screen.queryByTestId('dashboard-waitlist-row')).not.toBeInTheDocument();
  });

  it('stacks medical optimisation done against not done, printing both counts and the denominator', async () => {
    await signIn();

    renderPage();

    expect(await screen.findAllByTestId('dashboard-measure')).toHaveLength(6);
    expect(texts('dashboard-measure')).toEqual([
      'Consultations in the last year12',
      'Echocardiogram in the last 13 months3 done, 7 not done, of 10',
      'Retained in care (seen in the last 7 months)8 done, 2 not done, of 10',
      'Intervention assigned2 done, 8 not done, of 10',
      'Interventions completed1 done, 3 not done, of 4',
      'On warfarin, with an INR in the last 90 days1 done, 1 not done, of 2',
    ]);
    expect(chartData(StackedBarChart, 'Medical optimisation')).toEqual(
      expect.arrayContaining([
        { group: 'Done', key: 'Echocardiogram in the last 13 months', value: 3 },
        { group: 'Not done', key: 'Echocardiogram in the last 13 months', value: 7 },
      ]),
    );
  });

  it('draws the screening cascade as bars and the diagnoses as a donut, each printing its counts', async () => {
    await signIn();

    renderPage();

    expect(await screen.findAllByTestId('dashboard-screening-step')).toHaveLength(4);
    expect(texts('dashboard-screening-step')).toEqual([
      'Active9',
      'Confirmatory Diagnosis444%',
      'Diagnosed4100%',
      'Heart Disease375%',
    ]);
    expect(texts('dashboard-screening-category')).toEqual(['Rheumatic Heart Disease/Rheumatic Fever3', 'Normal1']);
    expect(texts('dashboard-screening-details')).toEqual(['RHD A2']);
    expect(chartData(SimpleBarChart, 'Screening cascade')).toHaveLength(4);
    expect(chartData(DonutChart, 'Diagnoses after the echo')).toEqual([
      { group: 'Rheumatic Heart Disease/Rheumatic Fever', value: 3 },
      { group: 'Normal', value: 1 },
    ]);
  });

  it('evaluates the dated reports as of the date chosen, while the registry reads today', async () => {
    await signIn();
    renderPage();

    fireEvent.change(await screen.findByLabelText('Figures as of'), { target: { value: '2026-01-15' } });

    expect(paramsOf(CARE_CASCADE)).toEqual({ endDate: '2026-01-15' });
    expect(paramsOf(OPTIMISATION)).toEqual({ endDate: '2026-01-15' });
    expect(paramsOf(SCREENING)).toEqual({ endDate: '2026-01-15' });
    expect(paramsOf(DIAGNOSES)).toEqual({ endDate: '2026-01-15' });
    expect(paramsOf(REGISTRY)).toEqual({ startDate: '1900-01-01', endDate: today });
  });

  it('narrows every section to the clinic chosen', async () => {
    await signIn();
    renderPage();

    await userEvent.selectOptions(await screen.findByLabelText('Cardiac clinic'), 'lira');

    expect(await screen.findByText('Active registrants: 1')).toBeInTheDocument();
    expect(screen.getByText(/^Procedural waitlist: 1 patient/)).toBeInTheDocument();
    [CARE_CASCADE, OPTIMISATION, SCREENING, DIAGNOSES].forEach((report) =>
      expect(paramsOf(report)).toEqual({ endDate: today, cardiacClinic: 'lira' }),
    );
  });

  it('says which clinic has nobody to count, rather than drawing empty charts, and offers every clinic', async () => {
    await signIn();
    renderPage();

    await userEvent.selectOptions(await screen.findByLabelText('Cardiac clinic'), 'mbarara');

    expect(await screen.findAllByText('Nobody at Mbarara RRH to count')).toHaveLength(6);
    expect(screen.queryByTestId('dashboard-cascade-step')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-measure')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-screening-step')).not.toBeInTheDocument();

    await userEvent.click(screen.getAllByRole('button', { name: 'Show all clinics' })[0]);

    expect(screen.getByLabelText('Cardiac clinic')).toHaveValue('');
    expect(screen.queryByText('Nobody at Mbarara RRH to count')).not.toBeInTheDocument();
    expect(texts('dashboard-cascade-step')).toHaveLength(5);
  });

  it("shows a failed report's error in its own section only, and tries that report again", async () => {
    await signIn(OPTIMISATION);
    renderPage();

    expect(await screen.findByText('Medical optimisation could not load')).toBeInTheDocument();
    expect(screen.getAllByText(/ could not load$/)).toHaveLength(1);
    expect(texts('dashboard-status')).toEqual(['Active375%', 'Inactive - Death125%']);
    expect(texts('dashboard-cascade-step')).toHaveLength(5);

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(mutates[OPTIMISATION]).toHaveBeenCalledTimes(1);
    expect(mutates[CARE_CASCADE]).not.toHaveBeenCalled();
    expect(mutates[REGISTRY]).not.toHaveBeenCalled();
  });

  it('shows no figure on a tile, and names the section rather than its count, when the registry fails', async () => {
    await signIn(REGISTRY);
    renderPage();

    expect(await screen.findByText('Active registrants could not load')).toBeInTheDocument();
    expect(screen.getByText('Registrant status could not load')).toBeInTheDocument();
    expect(texts('dashboard-tile').slice(0, 2)).toEqual(['Registered–could not load', 'Active–could not load']);
    expect(texts('dashboard-tile')[2]).toBe('On secondary prophylaxis375% of active RHD');
  });

  it('names the waitlist rather than its count when the waiting list fails', async () => {
    await signIn(WAITLIST);
    renderPage();

    expect(await screen.findByText('Procedural waitlist could not load')).toBeInTheDocument();
    expect(texts('dashboard-tile')[3]).toBe('Waiting for a procedure–could not load');
  });

  it('says a chart within a section has nobody to count, rather than drawing it empty', async () => {
    await signIn(undefined, {
      [DIAGNOSES]: [{ breakdown: 'category', category: 'Normal', details: null, patients: 1 }],
    });
    renderPage();

    expect(await screen.findAllByTestId('dashboard-screening-step')).toHaveLength(4);
    expect(screen.getAllByText('No patients to count')).toHaveLength(1);
    expect(screen.queryByTestId('dashboard-screening-details')).not.toBeInTheDocument();
  });

  it('tries again only the screening report that failed', async () => {
    await signIn(DIAGNOSES);
    renderPage();

    expect(await screen.findByText('Screening cascade could not load')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(mutates[DIAGNOSES]).toHaveBeenCalledTimes(1);
    expect(mutates[SCREENING]).not.toHaveBeenCalled();
  });

  it('reads the prophylaxis tile by its step, and says when the cascade does not report it', async () => {
    await signIn(undefined, {
      [CARE_CASCADE]: [
        { step: 'Active', patients: 4 },
        { step: 'Initiated', patients: 2 },
      ],
    });
    renderPage();

    expect(await screen.findAllByTestId('dashboard-tile')).toHaveLength(4);
    expect(texts('dashboard-tile')[2]).toBe('On secondary prophylaxis–not reported');
  });

  it('colours each urgency by its number, whichever urgencies the clinic has', async () => {
    await signIn(undefined, {
      [WAITLIST]: [recommendation('p1', 'Balloon valvuloplasty', URGENT)],
    });
    renderPage();

    await screen.findByText(/^Procedural waitlist: 1 patient/);
    const waitlist = vi
      .mocked(StackedBarChart)
      .mock.calls.map(([props]) => props)
      .filter((props) => props.options?.accessibility?.svgAriaLabel === 'Procedural waitlist')
      .at(-1);
    expect(waitlist.options.color.scale).toEqual({ [URGENT]: '#ff832b' });
  });

  it('keeps drawing a chart with the same data, rather than redrawing it, when another part of the page changes', async () => {
    await signIn();
    renderPage();
    await screen.findAllByTestId('dashboard-status');
    const drawn = vi
      .mocked(DonutChart)
      .mock.calls.map(([props]) => props)
      .filter((props) => props.options?.accessibility?.svgAriaLabel === 'Registrant status');

    await userEvent.click(screen.getByRole('button', { name: 'Show as a table' }));

    const redrawn = vi
      .mocked(DonutChart)
      .mock.calls.map(([props]) => props)
      .filter((props) => props.options?.accessibility?.svgAriaLabel === 'Registrant status')
      .at(-1);
    expect(redrawn.data).toBe(drawn.at(-1).data);
    expect(redrawn.options).toBe(drawn.at(-1).options);
  });

  it('names the clinic opened at by the session location when it is not among the clinics listed, never by its uuid', async () => {
    await signIn(undefined, {}, { uuid: 'arua', display: 'Arua RRH', tags: [{ display: 'RHD Tertiary' }] });
    renderPage();

    expect(await screen.findAllByText('Nobody at Arua RRH to count')).toHaveLength(6);
    expect(screen.queryByText(/arua to count/)).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Show all clinics' })).toHaveLength(6);
  });

  it('reads the prophylaxis tile from the step the older cascade report names Prescribed Prophylaxis', async () => {
    await signIn(undefined, {
      [CARE_CASCADE]: [
        { step: 'Active', patients: 4 },
        { step: 'Prescribed Prophylaxis', patients: 3 },
      ],
    });
    renderPage();

    expect(await screen.findAllByTestId('dashboard-tile')).toHaveLength(4);
    expect(texts('dashboard-tile')[2]).toBe('On secondary prophylaxis375% of active RHD');
  });

  it('gives no share on the prophylaxis tile when the cascade does not report its active RHD', async () => {
    await signIn(undefined, { [CARE_CASCADE]: [{ step: 'Prescribed', patients: 3 }] });
    renderPage();

    expect(await screen.findAllByTestId('dashboard-tile')).toHaveLength(4);
    expect(texts('dashboard-tile')[2]).toBe('On secondary prophylaxis3active RHD not reported');
  });

  it('colours an urgency with no number apart from the numbered ones', async () => {
    await signIn(undefined, {
      [WAITLIST]: [
        recommendation('p1', 'Balloon valvuloplasty', URGENT),
        recommendation('p2', 'Balloon valvuloplasty', null),
      ],
    });
    renderPage();

    await screen.findByText(/^Procedural waitlist: 2 patient/);
    const waitlist = vi
      .mocked(StackedBarChart)
      .mock.calls.map(([props]) => props)
      .filter((props) => props.options?.accessibility?.svgAriaLabel === 'Procedural waitlist')
      .at(-1);
    expect(waitlist.options.color.scale).toEqual({ [URGENT]: '#ff832b', 'Not given': '#8d8d8d' });
  });
});
