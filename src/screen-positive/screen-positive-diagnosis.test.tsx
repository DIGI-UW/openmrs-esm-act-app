import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fetchCurrentPatient, launchWorkspace2, openmrsFetch, saveVisit } from '@openmrs/esm-framework';
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
  fetchCurrentPatient: vi.fn(),
}));
vi.mock('../reports/report-dataset.resource', () => ({ useReportDataset: vi.fn() }));

const informationForm = { uuid: 'a6646c51-130d-3b59-a442-959bea93487d', display: 'RHD Patient Information' };
const fhirPatient = { resourceType: 'Patient', id: 'patient-2' };
const mutate = vi.fn();

async function enterDiagnosis(name: string) {
  const row = screen.getByRole('row', { name: new RegExp(`${name}\\b`) });
  await userEvent.click(within(row).getByRole('button', { name: 'Enter diagnosis' }));
}

describe('Screen positive, Enter diagnosis', () => {
  beforeEach(async () => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    await signInWith(['App: act.screenPositive', 'Add Encounters']);
    vi.mocked(fetchCurrentPatient).mockResolvedValue(fhirPatient as never);
    vi.mocked(openmrsFetch).mockResolvedValue({ data: informationForm } as never);
    vi.mocked(useReportDataset).mockReturnValue({
      columns: [],
      rows: screenPositiveRows,
      isLoading: false,
      error: undefined,
      mutate,
    });
  });

  it('opens the form that recorded the Screen + to edit, beside the list, starting no visit', async () => {
    render(<ScreenPositive />);

    await enterDiagnosis('Patient 2');

    await vi.waitFor(() => expect(launchWorkspace2).toHaveBeenCalled());
    expect(vi.mocked(openmrsFetch).mock.calls[0][0]).toContain(informationForm.uuid);
    expect(saveVisit).not.toHaveBeenCalled();
    expect(launchWorkspace2).toHaveBeenCalledWith(
      'act-screen-positive-form-entry-workspace',
      { form: informationForm, encounterUuid: 'information-2' },
      { patient: fhirPatient, patientUuid: 'patient-2', visitContext: null, mutateVisitContext: mutate },
    );
  });

  it('opens the same form again for a second click, so the open form is not replaced', async () => {
    render(<ScreenPositive />);

    await enterDiagnosis('Patient 2');
    await enterDiagnosis('Patient 2');

    await vi.waitFor(() => expect(launchWorkspace2).toHaveBeenCalledTimes(2));
    const [first, second] = vi.mocked(launchWorkspace2).mock.calls as unknown as Array<[string, { form: object }]>;
    expect(second[1].form).toBe(first[1].form);
  });

  it('tries again on a later click after opening failed', async () => {
    vi.mocked(fetchCurrentPatient).mockRejectedValueOnce(new Error('forbidden'));
    render(<ScreenPositive />);

    await enterDiagnosis('Patient 2');
    await vi.waitFor(() => expect(vi.mocked(fetchCurrentPatient)).toHaveBeenCalledTimes(1));
    await enterDiagnosis('Patient 2');

    await vi.waitFor(() => expect(launchWorkspace2).toHaveBeenCalledTimes(1));
    expect(vi.mocked(fetchCurrentPatient)).toHaveBeenCalledTimes(2);
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
      within(screen.getByRole('row', { name: /Patient 2\b/ })).queryByRole('button', { name: 'Enter diagnosis' }),
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
