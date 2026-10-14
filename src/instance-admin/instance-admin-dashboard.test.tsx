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

function dataset(value: Partial<ReturnType<typeof useReportDataset>> = {}) {
  vi.mocked(useReportDataset).mockReturnValue({
    columns: [],
    rows: [
      { facility: 'Akunalaber HCIII', active_patients: 12, overdue: 2 },
      { facility: 'Anyeke HCIV', active_patients: 5, overdue: 4 },
    ],
    isLoading: false,
    error: undefined,
    mutate: vi.fn(),
    ...value,
  });
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

  it("totals the programme report's active and overdue patients over every clinic, for the current month, beside the Entered this week and Data completeness placeholders", () => {
    render(<InstanceAdminKpis />);

    expect(useReportDataset).toHaveBeenCalledWith('c4a9e2d1-7b3f-4e58-9a16-2f0d8b5c7e31', {
      startDate: '2026-09-01',
      endDate: '2026-09-30',
    });
    const kpis = screen.getAllByTestId('instance-admin-kpi');
    expect(kpis.map((kpi) => kpi.textContent)).toEqual([
      'Active patients17across your sites',
      'Overdue prophylaxis6needs follow-up',
      'Entered this week218forms saved',
      'Data completeness94%key fields',
    ]);
  });

  it("keeps every tile when the programme report fails, with a dash where the report's totals would go", () => {
    dataset({ error: new Error('boom') });

    render(<InstanceAdminKpis />);

    expect(screen.queryByText('Could not load the report')).not.toBeInTheDocument();
    const kpis = screen.getAllByTestId('instance-admin-kpi');
    expect(kpis.map((kpi) => kpi.textContent)).toEqual([
      'Active patients–across your sites',
      'Overdue prophylaxis–needs follow-up',
      'Entered this week218forms saved',
      'Data completeness94%key fields',
    ]);
  });
});
