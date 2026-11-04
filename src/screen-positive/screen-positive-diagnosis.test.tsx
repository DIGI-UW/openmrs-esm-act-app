import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { navigate, openmrsFetch } from '@openmrs/esm-framework';
import routes from '../routes.json';
import { signInWith } from '../access/sign-in.test-helper';
import { useReportDataset } from '../reports/report-dataset.resource';
import { screenPositiveRows } from './screen-positive.fixture';
import ScreenPositive from './screen-positive.component';

// Who may record a form is may-enter-form's own test; here every form may be recorded.
vi.mock('../access/may-enter-form', () => ({
  MayEnterForm: ({ children }: { children: React.ReactNode }) => children,
  useMayEnterForm: () => true,
}));
vi.mock('@openmrs/esm-framework', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  navigate: vi.fn(),
}));
vi.mock('../reports/report-dataset.resource', () => ({ useReportDataset: vi.fn() }));

const mutate = vi.fn();

async function recordDiagnosis(name: string) {
  const row = screen.getByRole('row', { name: new RegExp(`${name}\\b`) });
  await userEvent.click(within(row).getByRole('button', { name: 'Record diagnosis' }));
}

describe('Screen positive, Record diagnosis', () => {
  beforeEach(async () => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    await signInWith(['App: act.screenPositive', 'Add Encounters']);
    vi.mocked(useReportDataset).mockReturnValue({
      columns: [],
      rows: screenPositiveRows,
      isLoading: false,
      error: undefined,
      mutate,
    });
  });

  it("opens the patient's chart, where the Consultation visits card records the diagnosis on Patient Information", async () => {
    render(<ScreenPositive />);

    await recordDiagnosis('Patient 2');

    expect(navigate).toHaveBeenCalledWith({ to: '/openmrs/spa/patient/patient-2/chart' });
  });

  it('offers no action for a Screen + recorded without a form', () => {
    vi.mocked(useReportDataset).mockReturnValue({
      columns: [],
      rows: [{ ...screenPositiveRows[1], form_uuid: null }],
      isLoading: false,
      error: undefined,
      mutate,
    });

    render(<ScreenPositive />);

    expect(
      within(screen.getByRole('row', { name: /Patient 2\b/ })).queryByRole('button', { name: 'Record diagnosis' }),
    ).not.toBeInTheDocument();
    expect(openmrsFetch).not.toHaveBeenCalled();
  });

  it("is the screen positive list's own workspace, scoped to its page", () => {
    const group = routes.workspaceGroups2.find((g) => g.name === 'act-screen-positive');
    const window = routes.workspaceWindows2.find((w) => w.name === 'act-screen-positive-form-entry');
    const workspace = routes.workspaces2.find((w) => w.name === 'act-screen-positive-form-entry-workspace');

    expect(group.scopePattern).toBe('/home/act-screen-positive');
    expect(window.group).toBe(group.name);
    expect(workspace).toMatchObject({
      component: '@openmrs/esm-patient-forms-app#exportedPatientFormEntryWorkspace',
      window: window.name,
    });
  });
});
