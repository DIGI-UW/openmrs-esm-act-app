import React from 'react';
import dayjs from 'dayjs';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DonutChart, SimpleBarChart, StackedBarChart } from '@carbon/charts-react';
import { getDefaultsFromConfigSchema, openmrsFetch, useLayoutType, useSession } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import { signInWith } from '../access/sign-in.test-helper';
import { type Config, configSchema } from '../config-schema';
vi.mock('../table-filters/csv', () => ({ downloadCsv: vi.fn() }));
import { markTranslations } from '../i18n.test-helper';
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
const REGISTRANTS = '3b0a6c2e-8f41-5d7b-9e15-6a2c4d8f0b71';
const DASHBOARD_WAITLIST = '9d4e2f7a-1c63-5b08-8a2d-4f6e1b9c3a52';
const REGISTRANT_PATIENTS = 'e8296d2d-def8-5f8e-ba2d-78c59859b9e3';
const WAITLIST_PATIENTS = 'bc987343-8b70-5f95-84a8-d017cffa14da';
const OPTIMISATION_PATIENTS = '45c646b2-f223-585e-963a-3c74fe883ae4';
const SCREENING_REGISTRATIONS = '0f4b7c2d-6a1e-5d93-8b47-2c9e1f5a3d68';

const screeningRows = [
  { breakdown: 'total', label: 'Registered', patients: 5 },
  { breakdown: 'female', label: 'Female', patients: 3 },
  { breakdown: 'screen', label: 'Yes', patients: 2 },
  { breakdown: 'screen', label: 'No', patients: 2 },
  { breakdown: 'screen', label: 'Not recorded', patients: 1 },
  { breakdown: 'age', label: 'Adults 20+', patients: 1 },
  { breakdown: 'age', label: 'Children 0-9', patients: 1 },
  { breakdown: 'age', label: 'Adolescents 10-19', patients: 3 },
  { breakdown: 'detected', label: 'School', patients: 2 },
  { breakdown: 'detected', label: 'Community', patients: 1 },
  { breakdown: 'detected', label: 'Other', patients: 1 },
  { breakdown: 'detected', label: 'Not recorded', patients: 1 },
];

const patientRow = (name: string, value: string, date: string | null = null) => ({
  patient_uuid: `uuid-${name}`,
  rhd_id: `rhd-${name}`,
  full_name: name,
  sex: 'F',
  age_years: 14,
  cardiac_clinic: 'Gulu RRH',
  primary_care_clinic: 'Acimi HCIII',
  figure_value: value,
  figure_date: date,
});
const CARE_CASCADE = '9c6751ae-65fc-5f25-9aa6-8c65cb1dff68';
const WAITLIST = '5b0f1c2e-9d3a-4c1b-8f6e-2a7d9e4b3c10';
const OPTIMISATION = '733a512c-3243-4e91-a44a-06a8e5384606';
const SCREENING = '8b257a0c-7e96-5a01-9672-975cae3b0419';
const DIAGNOSES = '6ddf6b36-2789-4733-8433-a877d54795cf';

const today = dayjs().format('YYYY-MM-DD');

const EMERGENT = '1: emergent (24 hours)';
const URGENT = '2: urgent (60 days/2 months)';

const counted = (breakdown: string, counts: Record<string, number>) =>
  Object.entries(counts).map(([label, patients]) => ({ breakdown, label, patients }));

const recommendations = (procedure: string, urgency: string, patients: number, count = patients) => ({
  breakdown: 'open',
  procedure,
  urgency,
  patients,
  recommendations: count,
});

const performed = (bmv: number, surgery: number) => [
  {
    breakdown: 'performed',
    procedure: 'Mitral balloon valvuloplasty',
    urgency: null,
    patients: bmv,
    recommendations: bmv,
  },
  { breakdown: 'performed', procedure: 'Surgery', urgency: null, patients: surgery, recommendations: surgery },
];

/** The registrants and waitlist reports' rows for every clinic, for Lira, and for a clinic with no patients. */
const dashboardRows = (clinic?: string): Record<string, Array<Record<string, unknown>>> =>
  clinic === 'lira'
    ? {
        [REGISTRANTS]: [
          ...counted('status', { Active: 1 }),
          ...counted('sex', { Female: 1 }),
          ...counted('age', { '10-19': 1 }),
          ...counted('disease', { 'RHD B': 1 }),
        ],
        [DASHBOARD_WAITLIST]: [
          recommendations('Mitral valve repair/replacement', EMERGENT, 1),
          { breakdown: 'total', procedure: 'All', urgency: null, patients: 1, recommendations: 1 },
          ...performed(0, 0),
        ],
      }
    : ['mbarara', 'arua'].includes(clinic)
      ? {
          [REGISTRANTS]: [],
          [DASHBOARD_WAITLIST]: [
            { breakdown: 'total', procedure: 'All', urgency: null, patients: 0, recommendations: 0 },
            ...performed(0, 0),
          ],
        }
      : {
          [REGISTRANTS]: [
            ...counted('status', { Active: 3, 'Voluntary inactivity': 1 }),
            ...counted('sex', { Female: 2, Male: 1 }),
            ...counted('age', { '20-39': 1, '10-19': 2 }),
            ...counted('disease', { 'RHD B': 2, 'RHD A': 1 }),
          ],
          [DASHBOARD_WAITLIST]: [
            recommendations('Balloon valvuloplasty', EMERGENT, 1),
            recommendations('Mitral valve repair/replacement', EMERGENT, 1),
            recommendations('Mitral valve repair/replacement', URGENT, 1),
            { breakdown: 'total', procedure: 'All', urgency: null, patients: 2, recommendations: 3 },
            ...performed(2, 1),
          ],
          [SCREENING_REGISTRATIONS]: screeningRows,
        };

/** The count reports' rows as the server returns them: every step or measure, whatever its count. */
const countRows = (zero: boolean): Record<string, Array<Record<string, unknown>>> => {
  const n = (count: number) => (zero ? 0 : count);
  return {
    [CARE_CASCADE]: [
      { step: 'Active', patients: n(4) },
      { step: 'Prescribed', patients: n(3) },
      { step: 'Oral', patients: n(1) },
      { step: 'BPG', patients: n(2) },
      { step: 'Initiated', patients: n(3) },
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

const mutates: Record<string, ReturnType<typeof vi.fn>> = {};

/**
 * Signs in, by default at a location of neither clinic kind, so the dashboard opens on every clinic, with Gulu, Lira and
 * Mbarara to choose. Mbarara and Arua have no patients, so their count reports return their rows with every count zero.
 */
async function signIn(
  failing?: string,
  overrides: Record<string, Array<Record<string, unknown>>> = {},
  sessionLocation = { uuid: 'hq', display: 'Head office', tags: [] as Array<{ display: string }> },
  limitedTo?: string,
  config: Parameters<typeof signInWith>[1] = {},
) {
  await signInWith(limitedTo === undefined ? ['App: act.dashboard'] : ['App: act.dashboard', 'Edit Users'], config);
  const session = vi.mocked(useSession)();
  vi.mocked(useSession).mockReturnValue({
    ...session,
    ...(limitedTo !== undefined && {
      user: { ...session.user, userProperties: { 'actcore.clinics': limitedTo } },
    }),
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
          : url.includes('?v=custom:(display)')
            ? { display: url.includes('/gulu') ? 'Gulu RRH' : 'Lira RRH' }
            : { tags: sessionLocation.tags },
    })) as never);
  vi.mocked(useReportDataset).mockImplementation((report, params) => {
    const counts = {
      ...countRows(['mbarara', 'arua'].includes(params?.cardiacClinic)),
      ...dashboardRows(params?.cardiacClinic),
    };
    mutates[String(report)] ??= vi.fn();
    return {
      columns: [],
      rows: report === failing ? [] : (overrides[String(report)] ?? counts[String(report)] ?? []),
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

function chartOptions(chart: unknown, title: string) {
  const calls = vi.mocked(chart as typeof DonutChart).mock.calls.map(([props]) => props);
  const options = calls.filter((props) => props.options?.accessibility?.svgAriaLabel === title).at(-1)?.options;
  return options as { axes: Record<string, object>; legend: object };
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
    window.history.replaceState(null, '', '/openmrs/spa/home/act-dashboard');
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    vi.mocked(useReportDataset).mockReset();
    Object.keys(mutates).forEach((report) => delete mutates[report]);
  });

  it('shows the registered, active, prophylaxis and waiting figures as tiles', async () => {
    await signIn();

    renderPage();

    expect(await screen.findAllByTestId('dashboard-tile')).toHaveLength(4);
    expect(texts('dashboard-tile')).toEqual([
      'Registered4every status',
      'Active3enrolled and alive',
      'On secondary prophylaxis375% of active RHD',
      'Waiting for a procedure23 open recommendations',
    ]);
  });

  it('draws registrant status as a donut, printing the count and share of each status', async () => {
    await signIn();

    renderPage();

    expect(await screen.findByText('All 4 registrants, by where their registration stands')).toBeInTheDocument();
    expect(texts('dashboard-status')).toEqual(['Active375%', 'Voluntary inactivity125%']);
    expect(chartData(DonutChart, 'Registrant status')).toEqual([
      { group: 'Active', value: 3 },
      { group: 'Voluntary inactivity', value: 1 },
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
      'Initiated3100%',
      'Covered today267%',
      'Adherent (80%+)133%',
    ]);
    expect(chartData(SimpleBarChart, 'RHD care cascade')).toEqual([
      { group: 'Active', value: 4 },
      { group: 'Prescribed', value: 3 },
      { group: 'Initiated', value: 3 },
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

  it('evaluates the dated reports as of the date chosen', async () => {
    await signIn();
    renderPage();

    fireEvent.change(await screen.findByLabelText('Figures as of'), { target: { value: '2026-01-15' } });

    expect(paramsOf(CARE_CASCADE)).toEqual({ endDate: '2026-01-15' });
    expect(paramsOf(OPTIMISATION)).toEqual({ endDate: '2026-01-15' });
    expect(paramsOf(SCREENING)).toEqual({ endDate: '2026-01-15' });
    expect(paramsOf(DIAGNOSES)).toEqual({ endDate: '2026-01-15' });
  });

  it('leaves out the cascade steps ACT Core counts only today when the date chosen is past, and says why', async () => {
    await signIn();
    renderPage();
    expect(await screen.findAllByTestId('dashboard-cascade-step')).toHaveLength(5);
    expect(screen.queryByText(/ACT Core keeps them only for today/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Figures as of'), { target: { value: '2026-01-15' } });

    expect(texts('dashboard-cascade-step')).toEqual(['Active4', 'Prescribed375%', 'Initiated3100%']);
    expect(chartData(SimpleBarChart, 'RHD care cascade')).toEqual([
      { group: 'Active', value: 4 },
      { group: 'Prescribed', value: 3 },
      { group: 'Initiated', value: 3 },
    ]);
    expect(screen.getByText(/ACT Core keeps them only for today/)).toBeInTheDocument();
  });

  it('writes out every procedure, measure and step name on the chart axes and legends, rather than cutting it short', async () => {
    await signIn();
    renderPage();
    await screen.findAllByTestId('dashboard-cascade-step');

    const whole = { type: 'none' };
    const waitlist = chartOptions(StackedBarChart, 'Procedural waitlist');
    expect(waitlist.axes.bottom).toMatchObject({ mapsTo: 'key', truncation: whole });
    expect(waitlist.legend).toMatchObject({ truncation: whole });
    const optimisation = chartOptions(StackedBarChart, 'Medical optimisation');
    expect(optimisation.axes.left).toMatchObject({ mapsTo: 'key', truncation: whole });
    expect(optimisation.legend).toMatchObject({ truncation: whole });
    expect(chartOptions(SimpleBarChart, 'RHD care cascade').axes.bottom).toMatchObject({
      mapsTo: 'group',
      truncation: whole,
    });
  });

  it('lets the chart cut procedure and measure names short on a phone, so the bars keep the card width', async () => {
    await signIn();
    vi.mocked(useLayoutType).mockReturnValue('phone');
    renderPage();
    await screen.findAllByTestId('dashboard-waitlist-row');
    fireEvent.click(screen.getByRole('button', { name: 'Show as a chart' }));

    expect(chartOptions(StackedBarChart, 'Procedural waitlist').axes.bottom).toEqual({
      mapsTo: 'key',
      scaleType: 'labels',
    });
    expect(chartOptions(StackedBarChart, 'Medical optimisation').axes.left).toEqual({
      mapsTo: 'key',
      scaleType: 'labels',
    });
  });

  it('leaves out the Adherent step of the older cascade report, too, when the date chosen is past', async () => {
    await signIn(undefined, {
      [CARE_CASCADE]: [
        { step: 'Active', patients: 4 },
        { step: 'Initiated BPG', patients: 2 },
        { step: 'Adherent', patients: 1 },
      ],
    });
    renderPage();
    expect(await screen.findAllByTestId('dashboard-cascade-step')).toHaveLength(3);

    fireEvent.change(screen.getByLabelText('Figures as of'), { target: { value: '2026-01-15' } });

    expect(texts('dashboard-cascade-step')).toEqual(['Active4', 'Initiated250%']);
  });

  it('evaluates no report for a date before 1900, such as a year still being typed', async () => {
    await signIn();
    renderPage();
    await screen.findAllByTestId('dashboard-cascade-step');

    fireEvent.change(screen.getByLabelText('Figures as of'), { target: { value: '0202-01-01' } });

    expect(vi.mocked(useReportDataset).mock.calls.some(([, params]) => params?.endDate === '0202-01-01')).toBe(false);
    expect(paramsOf(CARE_CASCADE)).toEqual({ endDate: today });
  });

  it('narrows every section to the clinic chosen', async () => {
    await signIn();
    renderPage();

    await userEvent.selectOptions(await screen.findByLabelText('Cardiac clinic'), 'lira');

    expect(await screen.findByText('Active registrants: 1')).toBeInTheDocument();
    expect(screen.getByText(/^Procedural waitlist: 1 patient/)).toBeInTheDocument();
    [CARE_CASCADE, OPTIMISATION, SCREENING, DIAGNOSES, REGISTRANTS, DASHBOARD_WAITLIST].forEach((report) =>
      expect(paramsOf(report)).toEqual({ endDate: today, cardiacClinic: 'lira' }),
    );
  });

  it('says which clinic has nobody to count, rather than drawing empty charts, and offers every clinic', async () => {
    await signIn();
    renderPage();

    await userEvent.selectOptions(await screen.findByLabelText('Cardiac clinic'), 'mbarara');

    expect(await screen.findAllByText('Nobody at Mbarara RRH to count')).toHaveLength(7);
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
    expect(texts('dashboard-status')).toEqual(['Active375%', 'Voluntary inactivity125%']);
    expect(texts('dashboard-cascade-step')).toHaveLength(5);

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(mutates[OPTIMISATION]).toHaveBeenCalledTimes(1);
    expect(mutates[CARE_CASCADE]).not.toHaveBeenCalled();
    expect(mutates[REGISTRANTS]).not.toHaveBeenCalled();
  });

  it('shows no figure on a tile, and names the section rather than its count, when the registrant counts fail', async () => {
    await signIn(REGISTRANTS);
    renderPage();

    expect(await screen.findByText('Active registrants could not load')).toBeInTheDocument();
    expect(screen.getByText('Registrant status could not load')).toBeInTheDocument();
    expect(texts('dashboard-tile').slice(0, 2)).toEqual(['Registered–could not load', 'Active–could not load']);
    expect(texts('dashboard-tile')[2]).toBe('On secondary prophylaxis375% of active RHD');
  });

  it('names the waitlist rather than its count when the waitlist counts fail', async () => {
    await signIn(DASHBOARD_WAITLIST);
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
      [DASHBOARD_WAITLIST]: [
        recommendations('Balloon valvuloplasty', URGENT, 1),
        { breakdown: 'total', procedure: 'All', urgency: null, patients: 1, recommendations: 1 },
      ],
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

    expect(await screen.findAllByText('Nobody at Arua RRH to count')).toHaveLength(7);
    expect(screen.queryByText(/arua to count/)).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Show all clinics' })).toHaveLength(7);
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
      [DASHBOARD_WAITLIST]: [
        recommendations('Balloon valvuloplasty', URGENT, 1),
        recommendations('Balloon valvuloplasty', 'Not given', 1),
        { breakdown: 'total', procedure: 'All', urgency: null, patients: 2, recommendations: 2 },
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

  it('reads the registrants and the waitlist from their count reports, as of the date, never every registry row', async () => {
    await signIn();
    renderPage();

    fireEvent.change(await screen.findByLabelText('Figures as of'), { target: { value: '2026-01-15' } });

    expect(paramsOf(REGISTRANTS)).toEqual({ endDate: '2026-01-15' });
    expect(paramsOf(DASHBOARD_WAITLIST)).toEqual({ endDate: '2026-01-15' });
    expect(vi.mocked(useReportDataset).mock.calls.map(([report]) => report)).not.toContain(REGISTRY);
    expect(vi.mocked(useReportDataset).mock.calls.map(([report]) => report)).not.toContain(WAITLIST);
  });

  it('prints the balloon valvuloplasties and surgeries performed in the year to the date', async () => {
    await signIn();
    renderPage();

    expect(await screen.findByTestId('dashboard-performed')).toHaveTextContent(
      'Performed in the 12 months to the date shown: mitral balloon valvuloplasty 2, surgery 1',
    );
  });

  it('holds a clinic-limited administrator at All to the clinics on their account', async () => {
    await signIn(undefined, {}, undefined, 'gulu,lira');
    renderPage();

    await screen.findAllByTestId('dashboard-tile');
    await vi.waitFor(() => expect(paramsOf(REGISTRANTS)).toEqual({ endDate: today, clinics: 'gulu,lira' }));
    expect(paramsOf(DASHBOARD_WAITLIST)).toEqual({ endDate: today, clinics: 'gulu,lira' });
  });

  it('counts nobody for a clinic-limited administrator with no clinic on their account', async () => {
    await signIn(undefined, {}, undefined, '');
    renderPage();

    expect(await screen.findAllByText('No patients to count')).not.toHaveLength(0);
    const evaluated = vi.mocked(useReportDataset).mock.calls.map(([report]) => report);
    expect(evaluated).not.toContain(REGISTRANTS);
    expect(evaluated).not.toContain(DASHBOARD_WAITLIST);
    expect(texts('dashboard-tile').slice(0, 2)).toEqual(['Registered0every status', 'Active0enrolled and alive']);
  });

  it("evaluates no registrant or waitlist count while a clinic-limited administrator's clinics are read", async () => {
    await signIn(undefined, {}, undefined, 'gulu');
    const answer = vi.mocked(openmrsFetch).getMockImplementation();
    vi.mocked(openmrsFetch).mockImplementation(((url: string, ...rest: Array<unknown>) =>
      url.includes('?v=custom:(display)') ? new Promise(() => {}) : answer(url, ...rest)) as never);
    renderPage();

    await screen.findAllByTestId('dashboard-tile');
    const evaluated = vi.mocked(useReportDataset).mock.calls.map(([report]) => report);
    expect(evaluated).not.toContain(REGISTRANTS);
    expect(evaluated).not.toContain(DASHBOARD_WAITLIST);
    expect(texts('dashboard-tile')[0]).toBe('Registered');
  });

  it('holds a clinic-limited administrator to their clinics at a clinic chosen, too, such as one they are signed in at', async () => {
    await signIn(
      undefined,
      {},
      { uuid: 'arua', display: 'Arua RRH', tags: [{ display: 'RHD Tertiary' }] },
      'gulu,lira',
    );
    renderPage();

    await screen.findAllByTestId('dashboard-tile');
    await vi.waitFor(() =>
      expect(paramsOf(REGISTRANTS)).toEqual({ endDate: today, cardiacClinic: 'arua', clinics: 'gulu,lira' }),
    );
    expect(paramsOf(DASHBOARD_WAITLIST)).toEqual({ endDate: today, cardiacClinic: 'arua', clinics: 'gulu,lira' });
  });

  it('prints the procedures performed even when nobody is waiting', async () => {
    await signIn(undefined, {
      [DASHBOARD_WAITLIST]: [
        { breakdown: 'total', procedure: 'All', urgency: null, patients: 0, recommendations: 0 },
        {
          breakdown: 'performed',
          procedure: 'Mitral balloon valvuloplasty',
          urgency: null,
          patients: 1,
          recommendations: 1,
        },
        { breakdown: 'performed', procedure: 'Surgery', urgency: null, patients: 0, recommendations: 0 },
      ],
    });
    renderPage();

    expect(await screen.findByTestId('dashboard-performed')).toHaveTextContent('mitral balloon valvuloplasty 1');
  });

  it("shows Adherent as a share of Initiated BPG under the older cascade report's step names", async () => {
    await signIn(undefined, {
      [CARE_CASCADE]: [
        { step: 'Active', patients: 4 },
        { step: 'Initiated BPG', patients: 4 },
        { step: 'Adherent', patients: 1 },
      ],
    });
    renderPage();

    expect(await screen.findAllByTestId('dashboard-cascade-step')).toHaveLength(3);
    expect(texts('dashboard-cascade-step')).toEqual(['Active4', 'Initiated4100%', 'Adherent (80%+)125%']);
  });

  describe('the patients behind a figure', () => {
    const figureRows = {
      [REGISTRANT_PATIENTS]: [patientRow('Akello Atoo', 'Voluntary inactivity')],
      [WAITLIST_PATIENTS]: [patientRow('Okot Ojok', 'Mitral valve repair/replacement, 2: urgent (60 days/2 months)')],
      [OPTIMISATION_PATIENTS]: [
        patientRow('Lakot Lamwaka', 'Done', '2026-10-01'),
        patientRow('Lakot Lamwaka', 'Done', '2026-07-01'),
      ],
    };

    it("offers the cascade's step labels to translation, on its bars and steps, and still opens a step by its own name", async () => {
      markTranslations();
      await signIn(undefined, figureRows);
      renderPage();

      const steps = await screen.findAllByTestId('dashboard-cascade-step');
      expect(steps.map((step) => step.firstChild.textContent)).toEqual([
        '«Active»',
        '«Prescribed»',
        '«Initiated»',
        '«Covered today»',
        '«Adherent (80%+)»',
      ]);
      expect(chartData(SimpleBarChart, '«RHD care cascade»').map(({ group }) => group)).toEqual([
        '«Active»',
        '«Prescribed»',
        '«Initiated»',
        '«Covered today»',
        '«Adherent (80%+)»',
      ]);
      const { color } = chartOptions(SimpleBarChart, '«RHD care cascade»') as unknown as { color: { scale: object } };
      expect(color.scale).toHaveProperty('«Prescribed»');
      expect(within(steps[1]).getByRole('link')).toHaveAttribute(
        'href',
        expect.stringContaining('figure=cascade&step=Prescribed'),
      );
    });

    it('opens from a count with a banner, chips and the rows, and Back returns to the Dashboard as it was', async () => {
      await signIn(undefined, figureRows);
      renderPage();
      await userEvent.selectOptions(await screen.findByLabelText('Cardiac clinic'), 'lira');
      await screen.findByText('Active registrants: 1');

      const statusRow = (await screen.findAllByTestId('dashboard-status'))[0];
      await userEvent.click(within(statusRow).getByRole('link'));

      expect(
        await screen.findByText(/^Opened from the Dashboard: Registrant status, Active, 1 patient/),
      ).toBeInTheDocument();
      expect(paramsOf(REGISTRANT_PATIENTS)).toEqual({
        endDate: today,
        cardiacClinic: 'lira',
        breakdown: 'status',
        label: 'Active',
      });
      expect(screen.getByRole('button', { name: /Registrant status: Active/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cardiac clinic: Lira RRH/ })).toBeInTheDocument();
      expect(screen.getByRole('cell', { name: 'rhd-Akello Atoo' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Akello Atoo' })).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Back to the Dashboard' }));

      expect(await screen.findByLabelText('Cardiac clinic')).toHaveValue('lira');
      expect(screen.queryByText(/Opened from the Dashboard/)).not.toBeInTheDocument();
    });

    it('widens the list as a chip is removed: an Active registrants figure to every active registrant, the clinic to every clinic', async () => {
      await signIn(undefined, figureRows);
      window.history.replaceState(
        null,
        '',
        '/openmrs/spa/home/act-dashboard?cardiacClinic=lira&figure=registrants&breakdown=sex&label=Female',
      );
      renderPage();

      await userEvent.click(await screen.findByRole('button', { name: /Active registrants: Female/ }));
      await vi.waitFor(() =>
        expect(paramsOf(REGISTRANT_PATIENTS)).toEqual({
          endDate: today,
          cardiacClinic: 'lira',
          breakdown: 'active',
        }),
      );
      expect(screen.getByText(/^Opened from the Dashboard: Active, 1 patient/)).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: /Cardiac clinic: Lira RRH/ }));
      await vi.waitFor(() => expect(paramsOf(REGISTRANT_PATIENTS)).toEqual({ endDate: today, breakdown: 'active' }));
    });

    it('offers no figure chip on a figure already widened at a clinic and a past date, and sends its report no asOf', async () => {
      await signIn(undefined, figureRows);
      window.history.replaceState(
        null,
        '',
        '/openmrs/spa/home/act-dashboard?cardiacClinic=lira&asOf=2026-01-15&figure=registrants&breakdown=registered',
      );
      renderPage();

      expect(await screen.findByRole('button', { name: /Cardiac clinic: Lira RRH/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Registered/ })).not.toBeInTheDocument();
      expect(paramsOf(REGISTRANT_PATIENTS)).toEqual({
        endDate: '2026-01-15',
        cardiacClinic: 'lira',
        breakdown: 'registered',
      });
    });

    it('hands the banner and the date chip their values unescaped, as a procedure or a date carries a slash', async () => {
      const t = vi.spyOn(useTranslation(), 't');
      await signIn(undefined, figureRows);
      window.history.replaceState(
        null,
        '',
        '/openmrs/spa/home/act-dashboard?asOf=2026-01-15&figure=waitlist&breakdown=open&procedure=Mitral%20valve%20repair%2Freplacement',
      );
      renderPage();

      await screen.findByText(/^Opened from the Dashboard: /);
      expect(t).toHaveBeenCalledWith(
        'openedFromTheDashboard',
        expect.any(String),
        expect.objectContaining({
          figure: 'Procedural waitlist, Mitral valve repair/replacement',
          interpolation: { escapeValue: false },
        }),
      );
      expect(t).toHaveBeenCalledWith(
        'asOfDate',
        expect.any(String),
        expect.objectContaining({ date: '15/01/2026', interpolation: { escapeValue: false } }),
      );
      t.mockRestore();
    });

    it('lists consultations, not patients, behind the consultations figure, and says so', async () => {
      await signIn(undefined, figureRows);
      renderPage();

      const consultations = (await screen.findAllByTestId('dashboard-measure'))[0];
      await userEvent.click(within(consultations).getByRole('link'));

      expect(
        await screen.findByText(
          /^Opened from the Dashboard: Medical optimisation, Consultations in the last year, 2 consultations/,
        ),
      ).toBeInTheDocument();
      expect(paramsOf(OPTIMISATION_PATIENTS)).toEqual({ endDate: today, measure: 'consultations' });
      expect(screen.queryByRole('button', { name: /^Medical optimisation: / })).not.toBeInTheDocument();
    });

    it('widens a performed figure to every procedure performed, not to the open waitlist', async () => {
      await signIn(undefined, figureRows);
      window.history.replaceState(
        null,
        '',
        '/openmrs/spa/home/act-dashboard?figure=waitlist&breakdown=performed&procedure=Surgery',
      );
      renderPage();

      await userEvent.click(await screen.findByRole('button', { name: /Performed in the 12 months: Surgery/ }));

      await vi.waitFor(() => expect(paramsOf(WAITLIST_PATIENTS)).toEqual({ endDate: today, breakdown: 'performed' }));
      expect(
        screen.getByText(/^Opened from the Dashboard: Performed in the 12 months, 1 recommendation/),
      ).toBeInTheDocument();
    });

    it('widens a registrant status figure to every registrant', async () => {
      await signIn(undefined, figureRows);
      window.history.replaceState(
        null,
        '',
        '/openmrs/spa/home/act-dashboard?figure=registrants&breakdown=status&label=Deceased',
      );
      renderPage();

      await userEvent.click(await screen.findByRole('button', { name: /Registrant status: Deceased/ }));

      await vi.waitFor(() =>
        expect(paramsOf(REGISTRANT_PATIENTS)).toEqual({ endDate: today, breakdown: 'registered' }),
      );
    });

    it('offers no figure chip on the waiting for a procedure figure, which is already the whole waitlist', async () => {
      await signIn(undefined, figureRows);
      window.history.replaceState(null, '', '/openmrs/spa/home/act-dashboard?figure=waitlist&breakdown=total');
      renderPage();

      expect(
        await screen.findByText(/^Opened from the Dashboard: Waiting for a procedure, 1 patient/),
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Waiting for a procedure/ })).not.toBeInTheDocument();
    });

    it('offers no figure chip on the cascade Active step, which the report reads as no step', async () => {
      await signIn(undefined, figureRows);
      window.history.replaceState(null, '', '/openmrs/spa/home/act-dashboard?figure=cascade&step=Active');
      renderPage();

      expect(await screen.findByText(/^Opened from the Dashboard: RHD care cascade, Active/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^RHD care cascade/ })).not.toBeInTheDocument();
    });

    it.each([
      ['Prescribed', 'Prescribed'],
      ['Initiated BPG', 'Initiated'],
    ])('names cascade step %s on its chip by the label its bar shows, offered to translation', async (step, label) => {
      markTranslations();
      await signIn(undefined, figureRows);
      window.history.replaceState(
        null,
        '',
        `/openmrs/spa/home/act-dashboard?${new URLSearchParams({ figure: 'cascade', step })}`,
      );
      renderPage();

      expect(
        await screen.findByRole('button', { name: new RegExp(`^«RHD care cascade»: «${label}»`) }),
      ).toBeInTheDocument();
    });

    it("names the cascade's Active step by its configured label once widened, as its bar does", async () => {
      await signIn(undefined, figureRows, undefined, undefined, {
        careCascade: {
          report: '9c6751ae-65fc-5f25-9aa6-8c65cb1dff68',
          reportUrl: '${openmrsSpaBase}/reports',
          steps: [
            { step: 'Active', label: 'Active RHD' },
            { step: 'Prescribed', label: 'Prescribed' },
          ],
        },
      });
      window.history.replaceState(null, '', '/openmrs/spa/home/act-dashboard?figure=cascade&step=Prescribed');
      renderPage();

      await userEvent.click(await screen.findByRole('button', { name: /^RHD care cascade: Prescribed/ }));

      expect(await screen.findByText(/^Opened from the Dashboard: RHD care cascade, Active RHD/)).toBeInTheDocument();
    });

    it('widens a later cascade step to the Active step, and offers no figure chip there', async () => {
      await signIn(undefined, figureRows);
      window.history.replaceState(null, '', '/openmrs/spa/home/act-dashboard?figure=cascade&step=Prescribed');
      renderPage();

      await userEvent.click(await screen.findByRole('button', { name: /^RHD care cascade: Prescribed/ }));

      expect(await screen.findByText(/^Opened from the Dashboard: RHD care cascade, Active/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^RHD care cascade/ })).not.toBeInTheDocument();
    });

    it.each([
      ['age', '0-4'],
      ['disease', 'RHD'],
    ])('widens an Active registrants %s figure to every active registrant', async (breakdown, label) => {
      await signIn(undefined, figureRows);
      window.history.replaceState(
        null,
        '',
        `/openmrs/spa/home/act-dashboard?figure=registrants&breakdown=${breakdown}&label=${label}`,
      );
      renderPage();

      await userEvent.click(await screen.findByRole('button', { name: new RegExp(`Active registrants: ${label}`) }));

      await vi.waitFor(() => expect(paramsOf(REGISTRANT_PATIENTS)).toEqual({ endDate: today, breakdown: 'active' }));
    });

    it('opens the Dashboard on a figure it does not know, as a stale link can carry', async () => {
      await signIn(undefined, figureRows);
      window.history.replaceState(null, '', '/openmrs/spa/home/act-dashboard?figure=nonsense');
      renderPage();

      expect(await screen.findAllByTestId('dashboard-tile')).toHaveLength(4);
      expect(screen.queryByText(/Opened from the Dashboard/)).not.toBeInTheDocument();
    });

    it("returns to the Dashboard on the browser's Back from a figure", async () => {
      await signIn(undefined, figureRows);
      renderPage();

      await userEvent.click(within((await screen.findAllByTestId('dashboard-tile'))[0]).getByRole('link'));
      expect(await screen.findByText(/^Opened from the Dashboard: Registered/)).toBeInTheDocument();

      window.history.back();

      expect(await screen.findAllByTestId('dashboard-tile')).toHaveLength(4);
      expect(screen.queryByText(/Opened from the Dashboard/)).not.toBeInTheDocument();
    });

    it("links each count to its figure's URL with the Dashboard's filters, and leaves a modified click to the browser", async () => {
      await signIn(undefined, figureRows);
      renderPage();
      await userEvent.selectOptions(await screen.findByLabelText('Cardiac clinic'), 'lira');
      await screen.findByText('Active registrants: 1');

      const link = within(screen.getAllByTestId('dashboard-tile')[0]).getByRole('link');
      expect(link).toHaveAttribute(
        'href',
        '/openmrs/spa/home/act-dashboard?cardiacClinic=lira&figure=registrants&breakdown=registered',
      );

      fireEvent.click(link, { ctrlKey: true });
      expect(screen.queryByText(/Opened from the Dashboard/)).not.toBeInTheDocument();
    });

    it('opens the recommendations of a waitlist procedure and the patients behind the waiting tile', async () => {
      await signIn(undefined, figureRows);
      renderPage();

      const total = (await screen.findAllByTestId('dashboard-waitlist-total'))[1];
      await userEvent.click(within(total).getByRole('link'));
      expect(
        await screen.findByText(/Procedural waitlist, Mitral valve repair\/replacement, 1 recommendation/),
      ).toBeInTheDocument();
      expect(paramsOf(WAITLIST_PATIENTS)).toEqual({
        endDate: today,
        breakdown: 'open',
        procedure: 'Mitral valve repair/replacement',
      });

      await userEvent.click(screen.getByRole('button', { name: 'Back to the Dashboard' }));
      const waiting = (await screen.findAllByTestId('dashboard-tile'))[3];
      await userEvent.click(within(waiting).getByRole('link'));
      await vi.waitFor(() => expect(paramsOf(WAITLIST_PATIENTS)).toEqual({ endDate: today, breakdown: 'total' }));
    });

    it('makes every count a link: the tiles, status, demographics, cascade, waitlist and medical optimisation', async () => {
      await signIn();
      renderPage();

      await screen.findAllByTestId('dashboard-tile');
      for (const testId of [
        'dashboard-tile',
        'dashboard-status',
        'dashboard-sex',
        'dashboard-age',
        'dashboard-category',
        'dashboard-cascade-step',
        'dashboard-waitlist-total',
        'dashboard-measure',
      ]) {
        screen
          .getAllByTestId(testId)
          .forEach((row) => expect(within(row).getAllByRole('link').length).toBeGreaterThan(0));
      }
      expect(within(screen.getByTestId('dashboard-performed')).getAllByRole('link')).toHaveLength(2);
    });

    it("records the figure's CSV in the download log, with the figure and the Dashboard's filters", async () => {
      await signIn(undefined, figureRows);
      await signInWith(['App: act.dashboard', 'Task: act.lists.export']);
      vi.mocked(useReportDataset).mockImplementation((report) => ({
        columns: [],
        rows: figureRows[String(report)] ?? [],
        isLoading: false,
        error: undefined,
        mutate: vi.fn() as never,
      }));
      window.history.replaceState(
        null,
        '',
        '/openmrs/spa/home/act-dashboard?figure=registrants&breakdown=status&label=Active',
      );
      renderPage();

      await userEvent.click(await screen.findByRole('button', { name: 'Download CSV' }));

      await vi.waitFor(() =>
        expect(vi.mocked(openmrsFetch)).toHaveBeenCalledWith(
          '/ws/rest/v1/actcore/download/record',
          expect.objectContaining({
            body: expect.objectContaining({
              list: 'dashboard:registrants',
              rows: 1,
              identifiers: true,
              filters: expect.objectContaining({ breakdown: 'status', label: 'Active', endDate: today }),
            }),
          }),
        ),
      );
    });
  });

  describe('screening from registrations', () => {
    const yearBack = dayjs().subtract(364, 'day').format('YYYY-MM-DD');

    it('counts the patients registered in the 365 days to the date, and says it counts registrations, not screening', async () => {
      await signIn();
      renderPage();

      expect(await screen.findByText('Screening, from registrations')).toBeInTheDocument();
      expect(paramsOf(SCREENING_REGISTRATIONS)).toEqual({ startDate: yearBack, endDate: today });
      expect(
        screen.getByText(
          /Counts registered patients, not people screened: a screen-negative child is never registered/,
        ),
      ).toBeInTheDocument();
      expect(texts('dashboard-registration-tile')).toEqual(['Registered5', 'Female60%']);
      expect(texts('dashboard-screen-positive')).toEqual(['Yes2', 'No2', 'Not recorded1']);
      expect(texts('dashboard-registration-age')).toEqual(['Children 0-91', 'Adolescents 10-193', 'Adults 20+1']);
      expect(texts('dashboard-detected')).toEqual(['School2', 'Community1', 'Other1', 'Not recorded1']);
    });

    it('shows a label the report adds after the ones it knows, so the bars still sum to the registered', async () => {
      const t = vi.spyOn(useTranslation(), 't');
      await signIn(undefined, {
        [SCREENING_REGISTRATIONS]: [
          { breakdown: 'detected', label: 'Teacher referral', patients: 1 },
          ...screeningRows,
        ],
      });
      renderPage();

      await screen.findByText('Screening, from registrations');
      expect(texts('dashboard-detected')).toEqual([
        'School2',
        'Community1',
        'Other1',
        'Not recorded1',
        'Teacher referral1',
      ]);
      expect(t).toHaveBeenCalledWith('registeredCentre', 'registered');
      t.mockRestore();
    });

    it('counts the year to the date again when the date moves before the start chosen', async () => {
      await signIn();
      renderPage();
      await screen.findByText('Screening, from registrations');

      fireEvent.change(screen.getByLabelText('Registered from'), { target: { value: '2026-01-01' } });
      await vi.waitFor(() => expect(paramsOf(SCREENING_REGISTRATIONS)?.startDate).toBe('2026-01-01'));
      fireEvent.change(screen.getByLabelText('Figures as of'), { target: { value: '2025-12-01' } });

      await vi.waitFor(() =>
        expect(paramsOf(SCREENING_REGISTRATIONS)).toEqual({ startDate: '2024-12-02', endDate: '2025-12-01' }),
      );
      fireEvent.change(screen.getByLabelText('Registered from'), { target: { value: '2025-12-01' } });
      await vi.waitFor(() =>
        expect(paramsOf(SCREENING_REGISTRATIONS)).toEqual({ startDate: '2025-12-01', endDate: '2025-12-01' }),
      );
    });

    it('keeps the period to change when it counts nobody', async () => {
      await signIn();
      renderPage();
      await screen.findByText('Screening, from registrations');

      await userEvent.selectOptions(screen.getByLabelText('Cardiac clinic'), 'lira');

      await vi.waitFor(() => expect(screen.queryAllByTestId('dashboard-registration-tile')).toHaveLength(0));
      expect(screen.getByLabelText('Registered from')).toBeInTheDocument();
      expect(screen.getByLabelText('Registered to')).toBeInTheDocument();
    });

    it('evaluates the period chosen and the clinics chosen', async () => {
      await signIn();
      renderPage();
      await screen.findByText('Screening, from registrations');

      fireEvent.change(screen.getByLabelText('Registered from'), { target: { value: '2026-01-01' } });
      fireEvent.change(screen.getByLabelText('Registered to'), { target: { value: '2026-06-30' } });
      await userEvent.selectOptions(screen.getByLabelText('Cardiac clinic'), 'lira');

      await vi.waitFor(() =>
        expect(paramsOf(SCREENING_REGISTRATIONS)).toEqual({
          startDate: '2026-01-01',
          endDate: '2026-06-30',
          cardiacClinic: 'lira',
        }),
      );
    });

    it('holds a clinic-limited administrator to their clinics', async () => {
      await signIn(undefined, {}, undefined, 'gulu,lira');
      renderPage();

      await vi.waitFor(() =>
        expect(paramsOf(SCREENING_REGISTRATIONS)).toEqual({
          startDate: yearBack,
          endDate: today,
          clinics: 'gulu,lira',
        }),
      );
    });

    it('hides both screening sections at a site without a screening programme', async () => {
      await signIn(undefined, {}, undefined, undefined, {
        dashboard: { ...getDefaultsFromConfigSchema<Config>(configSchema).dashboard, showScreening: false },
      });
      renderPage();

      await screen.findAllByTestId('dashboard-tile');
      expect(screen.queryByText('Screening cascade')).not.toBeInTheDocument();
      expect(screen.queryByText('Screening, from registrations')).not.toBeInTheDocument();
      const evaluated = vi.mocked(useReportDataset).mock.calls.map(([report]) => report);
      [SCREENING, DIAGNOSES, SCREENING_REGISTRATIONS].forEach((report) => expect(evaluated).not.toContain(report));
    });
  });
});
