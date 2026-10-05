import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fetchCurrentPatient, launchWorkspace2, openmrsFetch, saveVisit, useSession } from '@openmrs/esm-framework';
import routes from '../routes.json';
import { signInWith } from '../access/sign-in.test-helper';
import { useReportDataset } from '../reports/report-dataset.resource';
import { screenPositiveRows } from './screen-positive.fixture';
import ScreenPositive from './screen-positive.component';

vi.mock('@openmrs/esm-framework', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchCurrentPatient: vi.fn(),
}));
vi.mock('../reports/report-dataset.resource', () => ({ useReportDataset: vi.fn() }));

const echoForm = { uuid: '88e54fb0-1243-3f7a-b925-f64648ca6635', display: 'RHD Echocardiogram' };
const fhirPatient = { resourceType: 'Patient', id: 'patient-2' };
const mutate = vi.fn();

function serve(activeVisits: Array<object>) {
  vi.mocked(openmrsFetch).mockImplementation(((url: string) =>
    Promise.resolve({ data: url.includes('/visit?') ? { results: activeVisits } : echoForm })) as never);
}

async function enterEcho(actId: string) {
  render(<ScreenPositive />);
  const row = screen.getByRole('row', { name: new RegExp(`${actId}\\b`) });
  await userEvent.click(within(row).getByRole('button', { name: 'Enter echo result' }));
}

describe('Screen positive, Enter echo result', () => {
  beforeEach(async () => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    await signInWith(['App: act.screenPositive', 'Task: act.enterClinicalForms']);
    vi.mocked(useSession).mockReturnValue({ ...vi.mocked(useSession)(), sessionLocation: { uuid: 'clinic' } } as never);
    vi.mocked(fetchCurrentPatient).mockResolvedValue(fhirPatient as never);
    vi.mocked(saveVisit).mockResolvedValue({
      data: { uuid: 'new-visit', visitType: { display: 'RHD Clinic Visit' } },
    } as never);
    vi.mocked(useReportDataset).mockReturnValue({
      columns: [],
      rows: screenPositiveRows,
      isLoading: false,
      error: undefined,
      mutate,
    });
  });

  it("opens the echo form beside the list, in the patient's active visit", async () => {
    serve([{ uuid: 'visit' }]);

    await enterEcho('rhd00002');

    await vi.waitFor(() => expect(launchWorkspace2).toHaveBeenCalled());
    expect(saveVisit).not.toHaveBeenCalled();
    expect(launchWorkspace2).toHaveBeenCalledWith(
      'act-screen-positive-form-entry-workspace',
      { form: echoForm, encounterUuid: '' },
      { patient: fhirPatient, patientUuid: 'patient-2', visitContext: { uuid: 'visit' }, mutateVisitContext: mutate },
    );
  });

  it('starts a visit for a patient with none, and opens the form in it', async () => {
    serve([]);

    await enterEcho('rhd00002');

    await vi.waitFor(() => expect(launchWorkspace2).toHaveBeenCalled());
    expect(vi.mocked(saveVisit).mock.calls[0][0]).toMatchObject({ patient: 'patient-2', location: 'clinic' });
    expect(vi.mocked(launchWorkspace2).mock.calls[0][2]).toMatchObject({ visitContext: { uuid: 'new-visit' } });
  });

  it('opens the same form and visit again for a second click, so the open form is not replaced', async () => {
    let active: Array<object> = [];
    vi.mocked(openmrsFetch).mockImplementation(((url: string) =>
      Promise.resolve({ data: url.includes('/visit?') ? { results: active } : echoForm })) as never);

    await enterEcho('rhd00002');
    await vi.waitFor(() => expect(launchWorkspace2).toHaveBeenCalledTimes(1));
    // The server now reports the visit just started as active, as a new object.
    active = [{ uuid: 'new-visit' }];
    await userEvent.click(
      within(screen.getByRole('row', { name: /rhd00002\b/ })).getByRole('button', { name: 'Enter echo result' }),
    );

    await vi.waitFor(() => expect(launchWorkspace2).toHaveBeenCalledTimes(2));
    expect(saveVisit).toHaveBeenCalledTimes(1);
    const [first, second] = vi.mocked(launchWorkspace2).mock.calls as unknown as Array<
      [string, { form: object }, { visitContext: object }]
    >;
    expect(second[1].form).toBe(first[1].form);
    expect(second[2].visitContext).toBe(first[2].visitContext);
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

  it('starts a new visit on a later click when the first has ended', async () => {
    let active: Array<object> = [];
    vi.mocked(openmrsFetch).mockImplementation(((url: string) =>
      Promise.resolve({ data: url.includes('/visit?') ? { results: active } : echoForm })) as never);
    vi.mocked(saveVisit)
      .mockResolvedValueOnce({ data: { uuid: 'first-visit', visitType: { display: 'RHD Clinic Visit' } } } as never)
      .mockResolvedValueOnce({ data: { uuid: 'second-visit', visitType: { display: 'RHD Clinic Visit' } } } as never);

    await enterEcho('rhd00002');
    await vi.waitFor(() => expect(launchWorkspace2).toHaveBeenCalledTimes(1));
    // The first visit is ended elsewhere; the lookup finds no active visit again.
    active = [];
    await userEvent.click(
      within(screen.getByRole('row', { name: /rhd00002\b/ })).getByRole('button', { name: 'Enter echo result' }),
    );

    await vi.waitFor(() => expect(launchWorkspace2).toHaveBeenCalledTimes(2));
    expect(saveVisit).toHaveBeenCalledTimes(2);
    expect(vi.mocked(launchWorkspace2).mock.calls[1][2]).toMatchObject({ visitContext: { uuid: 'second-visit' } });
  });

  it('tries again on a later click after opening failed', async () => {
    serve([{ uuid: 'visit' }]);
    vi.mocked(fetchCurrentPatient).mockRejectedValueOnce(new Error('forbidden'));

    await enterEcho('rhd00002');
    await vi.waitFor(() => expect(vi.mocked(fetchCurrentPatient)).toHaveBeenCalledTimes(1));
    await userEvent.click(
      within(screen.getByRole('row', { name: /rhd00002\b/ })).getByRole('button', { name: 'Enter echo result' }),
    );

    await vi.waitFor(() => expect(launchWorkspace2).toHaveBeenCalledTimes(1));
    expect(vi.mocked(fetchCurrentPatient)).toHaveBeenCalledTimes(2);
  });

  it("looks up only the patient's active visit", async () => {
    serve([{ uuid: 'visit' }]);

    await enterEcho('rhd00002');

    await vi.waitFor(() => expect(launchWorkspace2).toHaveBeenCalled());
    const lookup = vi
      .mocked(openmrsFetch)
      .mock.calls.map(([url]) => url)
      .find((url) => url.includes('/visit?'));
    expect(lookup).toContain('includeInactive=false');
  });

  it('starts one visit for two quick clicks', async () => {
    serve([]);
    let started: (value: unknown) => void;
    vi.mocked(saveVisit).mockReturnValue(new Promise((resolve) => (started = resolve)) as never);
    render(<ScreenPositive />);
    const button = within(screen.getByRole('row', { name: /rhd00002\b/ })).getByRole('button', {
      name: 'Enter echo result',
    });

    await userEvent.click(button);
    await userEvent.click(button);
    await vi.waitFor(() => expect(saveVisit).toHaveBeenCalled());
    started({ data: { uuid: 'new-visit', visitType: { display: 'RHD Clinic Visit' } } });

    await vi.waitFor(() => expect(launchWorkspace2).toHaveBeenCalledTimes(1));
    expect(saveVisit).toHaveBeenCalledTimes(1);
  });
});
