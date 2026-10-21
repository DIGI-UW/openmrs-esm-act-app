import React from 'react';
import dayjs from 'dayjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import { openmrsFetch, useSession } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { useReportDataset } from '../reports/report-dataset.resource';
import Dashboard from './dashboard.component';

vi.mock('../reports/report-dataset.resource', () => ({ useReportDataset: vi.fn() }));
// Carbon Charts draws with D3 into an SVG the test DOM cannot lay out, so each chart lists its points.
vi.mock('@carbon/charts-react', () => {
  const chart =
    (name: string) =>
    ({ data }: { data: Array<{ group: string; key: string; value: number }> }) => (
      <ul data-testid={name}>
        {data.map((d) => (
          <li key={`${d.group}-${d.key}`}>{`${d.group}|${d.key}|${d.value}`}</li>
        ))}
      </ul>
    );
  return {
    DonutChart: chart('donut'),
    SimpleBarChart: chart('bar'),
    StackedBarChart: chart('stacked'),
    ScaleTypes: { LABELS: 'labels' },
  };
});

const reports = {
  registrants: 'a2ca1cb0-e35e-4c42-8ffb-398283396165',
  care: '39c9d8ce-433f-449c-a0c5-ffb8e075207b',
  screening: '324be9a8-b377-4c57-88a2-0bff6bc271fc',
  screeningCascade: '8b257a0c-7e96-5a01-9672-975cae3b0419',
};

const rows = {
  [reports.registrants]: [
    { status: 'Active', age_band: '10-19', sex: 'F', category: 'Congenital heart disease', details: null, patients: 2 },
    {
      status: 'Active',
      age_band: '20-39',
      sex: 'M',
      category: 'Rheumatic Heart Disease/Rheumatic Fever',
      details: 'RHD A',
      patients: 1,
    },
    { status: 'Physical relocation', age_band: '40+', sex: 'M', category: null, details: null, patients: 1 },
  ],
  [reports.care]: [
    { measure: 'waitlist', label: 'Aortic valve surgery', grouping: '1: emergent (24 hours)', patients: 1 },
    { measure: 'performed', label: 'All procedures', grouping: null, patients: 3 },
    { measure: 'medicalOptimisation', label: 'Echocardiogram', grouping: 'Yes', patients: 2 },
  ],
  [reports.screening]: [{ screen_positive: 'Yes', detected_by: 'School', age_band: '10-19', sex: 'F', patients: 2 }],
  [reports.screeningCascade]: [
    { step: 'Confirmatory Diagnosis', patients: 2 },
    { step: 'Diagnosed', patients: 1 },
  ],
};

async function atCardiacClinic() {
  await signInWith(['App: act.dashboard']);
  const session = vi.mocked(useSession)();
  vi.mocked(useSession).mockReturnValue({
    ...session,
    sessionLocation: { uuid: 'gulu', display: 'Gulu RRH' },
  } as never);
  vi.mocked(openmrsFetch).mockImplementation(((url: string) =>
    Promise.resolve({
      data: url.includes('/location?tag=RHD%20Tertiary')
        ? { results: [{ uuid: 'gulu', display: 'Gulu RRH' }], totalCount: 1 }
        : url.includes('/location?tag=RHD%20Community')
          ? { results: [{ uuid: 'acimi', display: 'Acimi HCIII' }], totalCount: 1 }
          : url.includes('/location?tag=')
            ? { results: [], totalCount: 0 }
            : { tags: [{ display: 'RHD Tertiary' }] },
    })) as never);
}

function datasets(error?: Error) {
  vi.mocked(useReportDataset).mockImplementation((report) => ({
    columns: [],
    rows: report ? (rows[report] ?? []) : [],
    isLoading: false,
    error: report === reports.care ? error : undefined,
    mutate: vi.fn(),
  }));
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
    datasets();
  });

  it("runs each section's report for the session location's clinic, as of today", async () => {
    await atCardiacClinic();

    renderPage();

    const today = dayjs().format('YYYY-MM-DD');
    await waitFor(() => expect(paramsOf(reports.registrants)).toEqual({ endDate: today, cardiacClinic: 'gulu' }));
    expect(paramsOf(reports.care)).toEqual({ endDate: today, cardiacClinic: 'gulu' });
    expect(paramsOf(reports.screeningCascade)).toEqual({ endDate: today, cardiacClinic: 'gulu' });
    // Screening runs over the year to today, as ACT 2.0's did by default.
    expect(paramsOf(reports.screening)).toEqual({
      startDate: dayjs().subtract(1, 'year').format('YYYY-MM-DD'),
      endDate: today,
      cardiacClinic: 'gulu',
    });
  });

  it('draws the registrants, demographics, cascade, waitlist, medical optimisation and screening', async () => {
    await atCardiacClinic();

    renderPage();

    expect(await screen.findByText('Active|Active|3')).toBeInTheDocument();
    expect(screen.getByText('Physical relocation|Physical relocation|1')).toBeInTheDocument();
    expect(screen.getByText('Sex|Female|2')).toBeInTheDocument();
    expect(screen.getByText('Disease|Congenital heart disease|2')).toBeInTheDocument();
    expect(screen.getByText('Disease|RHD A|1')).toBeInTheDocument();
    expect(screen.getByText('Confirmatory echo received|Confirmatory echo received|1')).toBeInTheDocument();
    expect(screen.getByText('Confirmatory echo received: 50% of the step before')).toBeInTheDocument();
    expect(screen.getByText('1: emergent (24 hours)|Aortic valve surgery|1')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Procedures performed' })).toHaveTextContent('3');
    expect(screen.getByText('Yes|Echocardiogram|2')).toBeInTheDocument();
    expect(screen.getByText('No active patient is prescribed warfarin')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Percent female' })).toHaveTextContent('100%');
    expect(screen.getByText('School|School|2')).toBeInTheDocument();
  });

  it('lets the clinic be changed, and every section follows it', async () => {
    await atCardiacClinic();
    renderPage();

    const cardiac = await screen.findByRole('combobox', { name: 'Cardiac clinic' });
    await waitFor(() => expect(cardiac).toHaveValue('gulu'));
    await userEvent.selectOptions(cardiac, '');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Primary care clinic' }), 'acimi');

    for (const report of Object.values(reports)) {
      expect(paramsOf(report)).not.toHaveProperty('cardiacClinic');
      expect(paramsOf(report)).toHaveProperty('primaryCareClinic', 'acimi');
    }
  });

  it('narrows the demographics to the category chosen', async () => {
    await atCardiacClinic();
    renderPage();

    await userEvent.selectOptions(
      await screen.findByRole('combobox', { name: 'Category at diagnosis' }),
      'Congenital heart disease',
    );

    expect(screen.getByText('Sex|Female|2')).toBeInTheDocument();
    expect(screen.queryByText('Sex|Male|1')).not.toBeInTheDocument();
    expect(screen.getByText('Active|Active|3')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Category at diagnosis' }), '');
    expect(screen.getByText('Sex|Male|1')).toBeInTheDocument();
  });

  it('says which section could not load, and draws the others', async () => {
    await atCardiacClinic();
    datasets(new Error('boom'));

    renderPage();

    expect(await screen.findByText('Could not load Procedural waitlist')).toBeInTheDocument();
    expect(screen.getByText('Could not load Medical optimisation')).toBeInTheDocument();
    expect(screen.getByText('Active|Active|3')).toBeInTheDocument();
  });

  it('draws no screening while its end is before its start, and says so', async () => {
    await atCardiacClinic();
    renderPage();
    await screen.findByText('School|School|2');

    fireEvent.change(screen.getByRole('textbox', { name: 'Enrolled to' }), { target: { value: '2000-01-01' } });

    expect(await screen.findByText('The end is before the start')).toBeInTheDocument();
    expect(screen.queryByText('School|School|2')).not.toBeInTheDocument();
  });

  it('runs nothing while the clinic of the session location is unknown', async () => {
    await atCardiacClinic();
    vi.mocked(openmrsFetch).mockImplementation((() => new Promise(() => {})) as never);

    renderPage();

    await waitFor(() => expect(useReportDataset).toHaveBeenCalled());
    expect(vi.mocked(useReportDataset).mock.calls.every(([report]) => report === null)).toBe(true);
  });
});
