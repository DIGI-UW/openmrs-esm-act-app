import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { type AssignedExtension, ExtensionSlot, useAssignedExtensions, useSession } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { useReportDataset } from '../reports/report-dataset.resource';
import { InstanceAdminQuickActions } from '../quick-actions/quick-actions.component';
import InstanceAdminDashboard from './instance-admin-dashboard.component';
import { InstanceAdminKpis } from './instance-admin-kpis.component';

vi.mock('../reports/report-dataset.resource', () => ({ useReportDataset: vi.fn() }));

const mockUseAssignedExtensions = vi.mocked(useAssignedExtensions);

const PROGRAMME = 'c4a9e2d1-7b3f-4e58-9a16-2f0d8b5c7e31';
const KPIS = '6494be01-b4ae-46af-8d7f-058a2f95c115';

const programmeRows = [
  { facility: 'Akunalaber HCIII', active_patients: 12, overdue: 2 },
  { facility: 'Anyeke HCIV', active_patients: 5, overdue: 4 },
];
// Five forms this week; three of the four patients on the registry now carry no missing-data flag.
const kpiRows = [{ encounters: 5, active_patients: 4, active_complete: 3 }];

/** Each report answered by uuid: the programme report and the KPI report. */
function dataset(value: Partial<ReturnType<typeof useReportDataset>> = {}, failing: Array<string> = []) {
  vi.mocked(useReportDataset).mockImplementation((report) => ({
    columns: [],
    rows: report === PROGRAMME ? programmeRows : report === KPIS ? kpiRows : [],
    isLoading: false,
    error: failing.includes(String(report)) ? new Error('boom') : undefined,
    mutate: vi.fn(),
    ...value,
  }));
}

function session() {
  vi.mocked(useSession).mockReturnValue({
    authenticated: true,
    sessionId: 'session',
    user: { uuid: 'admin', privileges: [], roles: [] },
    sessionLocation: { uuid: 'instance', display: 'Uganda instance' },
  } as never);
}

describe('InstanceAdminDashboard', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 8, 28, 10, 0));
    await signInWith(['App: act.instanceAdmin']);
    session();
    dataset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is headed Home, with the session's location and today's date", () => {
    mockUseAssignedExtensions.mockReturnValue([{ id: 'widget' } as AssignedExtension]);

    render(<InstanceAdminDashboard />);

    const header = screen.getByTestId('act-page-header');
    expect(within(header).getByRole('heading', { level: 1 })).toHaveTextContent('Home');
    expect(within(header).getByText('Uganda instance')).toBeInTheDocument();
    expect(within(header).getByText('28-Sept-2026')).toBeInTheDocument();
  });

  it('says so while no widget is assigned to Home', () => {
    mockUseAssignedExtensions.mockReturnValue([]);

    render(<InstanceAdminDashboard />);

    expect(screen.getByText('No widgets have been added to Home yet.')).toBeInTheDocument();
  });

  it("renders the widgets assigned to Home's own slot", () => {
    mockUseAssignedExtensions.mockReturnValue([{ id: 'widget' } as AssignedExtension]);

    render(<InstanceAdminDashboard />);

    expect(mockUseAssignedExtensions).toHaveBeenCalledWith('act-instance-admin-widgets-slot');
    expect(vi.mocked(ExtensionSlot).mock.lastCall[0]).toEqual(
      expect.objectContaining({ name: 'act-instance-admin-widgets-slot' }),
    );
  });

  it('frames the quick action tiles under Quick actions, from their own slot, tagged for Instance Administrator', () => {
    render(<InstanceAdminQuickActions />);

    expect(screen.getByRole('heading', { name: 'Quick actions' })).toBeInTheDocument();
    expect(screen.getByText('Shown for Instance Administrator')).toBeInTheDocument();
    expect(vi.mocked(ExtensionSlot).mock.lastCall[0]).toEqual(
      expect.objectContaining({ name: 'act-instance-admin-quick-actions-slot' }),
    );
  });

  it("totals the programme report's active and overdue patients over every clinic for the month, and reads the week's forms and the share of active patients with no missing data from the KPI report's counts", () => {
    render(<InstanceAdminKpis />);

    expect(useReportDataset).toHaveBeenCalledWith(PROGRAMME, { startDate: '2026-09-01', endDate: '2026-09-30' });
    // The last seven days, today included.
    expect(useReportDataset).toHaveBeenCalledWith(KPIS, { startDate: '2026-09-22', endDate: '2026-09-28' });
    // Counts only: no patient list is downloaded for the figures.
    expect(vi.mocked(useReportDataset).mock.calls.map(([report]) => report)).toEqual([PROGRAMME, KPIS]);
    const kpis = screen.getAllByTestId('instance-admin-kpi');
    expect(kpis.map((kpi) => kpi.textContent)).toEqual([
      'Active patients17across your sites',
      'Overdue prophylaxis6needs follow-up',
      'Entered this week5forms dated in the last 7 days',
      'Data completeness75%active patients with no missing data',
    ]);
  });

  it('shows a dash for completeness with nobody on the registry, and counts a week with no forms as 0', () => {
    vi.mocked(useReportDataset).mockImplementation((report) => ({
      columns: [],
      rows: report === PROGRAMME ? programmeRows : [{ encounters: 0, active_patients: 0, active_complete: 0 }],
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    }));

    render(<InstanceAdminKpis />);

    const kpis = screen.getAllByTestId('instance-admin-kpi');
    expect(kpis[2]).toHaveTextContent('Entered this week0');
    expect(kpis[3]).toHaveTextContent('Data completeness–');
  });

  it('shows dashes for the KPI figures when the report returns no row, as on a distro without it', () => {
    vi.mocked(useReportDataset).mockImplementation((report) => ({
      columns: [],
      rows: report === PROGRAMME ? programmeRows : [],
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    }));

    render(<InstanceAdminKpis />);

    const kpis = screen.getAllByTestId('instance-admin-kpi');
    expect(kpis[0]).toHaveTextContent('Active patients17');
    expect(kpis[2]).toHaveTextContent('Entered this week–');
    expect(kpis[3]).toHaveTextContent('Data completeness–');
  });

  it("shows the other tiles' figures when only one report fails", () => {
    dataset({}, [KPIS]);

    render(<InstanceAdminKpis />);

    const kpis = screen.getAllByTestId('instance-admin-kpi');
    expect(kpis.map((kpi) => kpi.textContent)).toEqual([
      'Active patients17across your sites',
      'Overdue prophylaxis6needs follow-up',
      'Entered this week–forms dated in the last 7 days',
      'Data completeness–active patients with no missing data',
    ]);
  });

  it('keeps every tile when a report fails, with a dash where its figure would go', () => {
    dataset({}, [PROGRAMME, KPIS]);

    render(<InstanceAdminKpis />);

    expect(screen.queryByText('Could not load the report')).not.toBeInTheDocument();
    const kpis = screen.getAllByTestId('instance-admin-kpi');
    expect(kpis.map((kpi) => kpi.textContent)).toEqual([
      'Active patients–across your sites',
      'Overdue prophylaxis–needs follow-up',
      'Entered this week–forms dated in the last 7 days',
      'Data completeness–active patients with no missing data',
    ]);
  });
});
