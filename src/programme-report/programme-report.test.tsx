import React from 'react';
import dayjs from 'dayjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import { DashboardExtension, openmrsFetch, useSession } from '@openmrs/esm-framework';
import { homePrivilege, signInWith } from '../access/sign-in.test-helper';
import { useReportDataset } from '../reports/report-dataset.resource';
import Reports from './reports.component';
import FacilityReports from './facility-reports.component';
import FacilityReportsDashboardLink from './facility-reports-dashboard-link.component';

vi.mock('../reports/report-dataset.resource', () => ({ useReportDataset: vi.fn() }));
vi.mock('@openmrs/esm-framework', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  DashboardExtension: vi.fn(() => null),
}));

const rows = [
  {
    facility: 'Akunalaber HCIII',
    facility_uuid: 'akunalaber',
    active_patients: 12,
    due_this_week: 3,
    overdue: 2,
    bpg_on_time: 8,
    bpg_timed: 10,
    adherence: 91,
    data_tag: 'Complete',
  },
  {
    facility: 'Anyeke HCIV',
    facility_uuid: 'anyeke',
    active_patients: 5,
    due_this_week: 1,
    overdue: 4,
    bpg_on_time: 1,
    bpg_timed: 2,
    adherence: 78,
    data_tag: 'Review',
  },
  {
    facility: 'No primary care clinic',
    facility_uuid: null,
    active_patients: 1,
    due_this_week: 0,
    overdue: 0,
    bpg_on_time: 0,
    bpg_timed: 0,
    adherence: null,
    data_tag: 'Duplicates',
  },
];

async function atLocation(tags: Array<string> | null, privileges = ['App: act.reports']) {
  await signInWith(privileges);
  const session = vi.mocked(useSession)();
  vi.mocked(useSession).mockReturnValue({
    ...session,
    sessionLocation: tags ? { uuid: 'session-location', display: 'Gulu RRH' } : undefined,
  } as never);
  vi.mocked(openmrsFetch).mockImplementation(((url: string) =>
    Promise.resolve({
      data: url.includes('/location?tag=RHD%20Tertiary')
        ? { results: [{ uuid: 'session-location', display: 'Gulu RRH' }], totalCount: 1 }
        : url.includes('/location?tag=RHD%20Community')
          ? { results: [{ uuid: 'acimi', display: 'Acimi HCIII' }], totalCount: 1 }
          : url.includes('/location?tag=')
            ? { results: [], totalCount: 0 }
            : { tags: (tags ?? []).map((display) => ({ display })) },
    })) as never);
}

function dataset(value: Partial<ReturnType<typeof useReportDataset>> = {}) {
  vi.mocked(useReportDataset).mockReturnValue({
    columns: [],
    rows,
    isLoading: false,
    error: undefined,
    mutate: vi.fn(),
    ...value,
  });
}

function renderPage(Page: React.ComponentType = Reports) {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <Page />
    </SWRConfig>,
  );
}

const lastParams = () => vi.mocked(useReportDataset).mock.calls.at(-1)[1];
const tile = (label: string) => screen.getAllByTestId('report-tile').find((t) => t.textContent.startsWith(label));

describe('Reports', () => {
  beforeEach(() => {
    vi.mocked(useReportDataset).mockReset();
    dataset();
  });

  it("totals the facilities' rows in the tiles, the on-time rate over the period's timed injections", async () => {
    await atLocation(['RHD Tertiary']);

    renderPage();

    await waitFor(() => expect(tile('Active patients')).toHaveTextContent('Active patients18'));
    expect(tile('Due this week')).toHaveTextContent('4');
    expect(tile('Overdue')).toHaveTextContent('6');
    // 9 of 12 timed injections on time.
    expect(tile('BPG on-time rate')).toHaveTextContent(`75%${dayjs().format('MMM YYYY')}`);
  });

  it('shows no rate when no injection in the period was timed', async () => {
    await atLocation(['RHD Tertiary']);
    dataset({ rows: [{ ...rows[2] }] });

    renderPage();

    await waitFor(() => expect(tile('BPG on-time rate')).toHaveTextContent('BPG on-time rate–'));
  });

  it('lists each facility with its active patients, adherence and data tag', async () => {
    await atLocation(['RHD Tertiary']);

    renderPage();

    const table = await screen.findByRole('table');
    expect(
      within(table)
        .getAllByRole('row')
        .map((row) =>
          within(row)
            .queryAllByRole('cell')
            .map((cell) => cell.textContent),
        ),
    ).toEqual([
      [],
      ['Akunalaber HCIII', '12 active', '91%', 'Complete'],
      ['Anyeke HCIV', '5 active', '78%', 'Review'],
      ['No primary care clinic', '1 active', '', 'Duplicates'],
    ]);
  });

  it.each([
    [['RHD Tertiary'], { cardiacClinic: 'session-location' }],
    [['RHD Community'], { primaryCareClinic: 'session-location' }],
    [['Visit Location'], {}],
  ])('at a location tagged %j, scopes the report to %j', async (tags, scope) => {
    await atLocation(tags);

    renderPage();

    await waitFor(() =>
      expect(vi.mocked(useReportDataset).mock.calls.at(-1)[0]).toBe('c4a9e2d1-7b3f-4e58-9a16-2f0d8b5c7e31'),
    );
    expect(lastParams()).toEqual({ startDate: expect.any(String), endDate: expect.any(String), ...scope });
  });

  it('runs the report over this month, then over the quarter chosen', async () => {
    await atLocation(['RHD Tertiary']);
    renderPage();
    await waitFor(() => expect(lastParams()).toHaveProperty('startDate'));
    // Plain dates, which the server reads as written whatever its time zone.
    expect(lastParams().startDate).toBe(dayjs().startOf('month').format('YYYY-MM-DD'));
    expect(lastParams().endDate).toBe(dayjs().endOf('month').format('YYYY-MM-DD'));

    await userEvent.click(screen.getByRole('tab', { name: 'Quarter' }));
    const quarters = screen.getByRole('combobox', { name: 'Period' });
    await userEvent.selectOptions(quarters, within(quarters).getAllByRole('option')[1]);

    const start = dayjs(lastParams().startDate);
    expect(start.date()).toBe(1);
    expect(start.month() % 3).toBe(0);
    expect(dayjs(lastParams().endDate).diff(start, 'month')).toBe(2);
  });

  it('says so when the report cannot be loaded', async () => {
    await atLocation(['RHD Tertiary']);
    dataset({ rows: [], error: new Error('boom') });

    renderPage();

    expect(await screen.findByText('Could not load the report')).toBeInTheDocument();
  });

  it("lets the clinic be changed, starting at the session location's, as ACT 2.0's dashboard did", async () => {
    await atLocation(['RHD Tertiary']);
    renderPage();

    const cardiac = await screen.findByRole('combobox', { name: 'Cardiac clinic' });
    await waitFor(() => expect(cardiac).toHaveValue('session-location'));
    expect(screen.getByRole('combobox', { name: 'Primary care clinic' })).toHaveValue('');

    await userEvent.selectOptions(cardiac, '');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Primary care clinic' }), 'acimi');

    expect(lastParams()).not.toHaveProperty('cardiacClinic');
    expect(lastParams()).toHaveProperty('primaryCareClinic', 'acimi');
  });

  it('keeps Facility reports at the session location, with no clinic filters', async () => {
    await atLocation(['RHD Community'], ['App: act.dataClerk']);

    renderPage(FacilityReports);

    await waitFor(() => expect(lastParams()).toHaveProperty('primaryCareClinic', 'session-location'));
    expect(screen.queryByRole('combobox', { name: 'Cardiac clinic' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Primary care clinic' })).not.toBeInTheDocument();
  });

  it("keeps Facility reports at a location that is no RHD clinic, so it never shows other clinics' numbers", async () => {
    await atLocation(['Visit Location'], ['App: act.dataClerk']);

    renderPage(FacilityReports);

    await waitFor(() =>
      expect(lastParams()).toEqual({
        startDate: expect.any(String),
        endDate: expect.any(String),
        primaryCareClinic: 'session-location',
      }),
    );
  });

  it.each([
    ['Reports', Reports],
    ['Facility reports', FacilityReports],
  ])("%s says so, and runs no report, when the session location's clinic cannot be looked up", async (_, Page) => {
    await atLocation(['RHD Community'], ['App: act.reports', 'App: act.dataClerk']);
    vi.mocked(openmrsFetch).mockRejectedValue(new Error('timeout'));

    renderPage(Page);

    expect(await screen.findByText('Could not load the report')).toBeInTheDocument();
    expect(vi.mocked(useReportDataset).mock.calls.every(([report]) => report === null)).toBe(true);
  });

  it("names the session's clinic in its filter while the clinic list loads, rather than All", async () => {
    await atLocation(['RHD Tertiary']);
    const tagsOnly = vi.mocked(openmrsFetch).getMockImplementation();
    vi.mocked(openmrsFetch).mockImplementation(((url: string) =>
      url.includes('/location?tag=') ? new Promise(() => undefined) : tagsOnly(url)) as never);

    renderPage();

    const cardiac = await screen.findByRole('combobox', { name: 'Cardiac clinic' });
    expect(cardiac).toHaveValue('session-location');
    expect(within(cardiac).getByRole('option', { selected: true })).toHaveTextContent('Gulu RRH');
  });

  it('is the same page as Facility reports, under its own title', async () => {
    await atLocation(['RHD Community'], ['App: act.dataClerk']);

    renderPage(FacilityReports);

    expect(within(screen.getByTestId('act-page-header')).getByText('Facility reports')).toBeInTheDocument();
    await waitFor(() => expect(tile('Overdue')).toHaveTextContent('6'));
  });
});

describe('FacilityReportsDashboardLink', () => {
  beforeEach(() => {
    window.spaBase = '/openmrs/spa';
    vi.mocked(DashboardExtension).mockClear();
  });

  it('links the home left nav to /home/act-facility-reports', async () => {
    await signInWith(['App: act.dataClerk']);

    render(<FacilityReportsDashboardLink />);

    expect(vi.mocked(DashboardExtension).mock.calls[0][0]).toEqual(
      expect.objectContaining({ path: 'act-facility-reports', title: 'Facility reports' }),
    );
  });

  it('is left out for a user whose home is ACT home, who has Reports', async () => {
    await signInWith(['App: act.dataClerk', homePrivilege]);

    render(<FacilityReportsDashboardLink />);

    expect(DashboardExtension).not.toHaveBeenCalled();
  });
});
