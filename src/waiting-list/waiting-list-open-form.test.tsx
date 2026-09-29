import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fetchCurrentPatient, launchWorkspace2, navigate, openmrsFetch, showSnackbar } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { useReportDataset } from '../reports/report-dataset.resource';
import { waitingListRows } from './waiting-list.fixture';
import WaitingList from './waiting-list.component';

vi.mock('@openmrs/esm-framework', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchCurrentPatient: vi.fn(),
}));
vi.mock('../reports/report-dataset.resource', () => ({ useReportDataset: vi.fn() }));

const consultationForm = { uuid: '4b063fc7-996f-3001-8500-8940e201be8f', name: 'RHD Consultation Visit' };
const patient = { id: 'patient-3', resourceType: 'Patient' } as fhir.Patient;
const mutate = vi.fn();

async function openFormOf(actId: string) {
  await userEvent.click(
    within(screen.getByRole('row', { name: new RegExp(`${actId}\\b`) })).getByRole('button', { name: 'Open form' }),
  );
}

describe('Opening a recommendation consultation from the waiting list', () => {
  beforeEach(async () => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    window.history.replaceState(null, '', '/openmrs/spa/home/act-waiting-list');
    await signInWith(['View Patient Flags']);
    vi.mocked(useReportDataset).mockReturnValue({
      columns: [],
      rows: waitingListRows,
      isLoading: false,
      error: undefined,
      mutate,
    });
    vi.mocked(openmrsFetch).mockResolvedValue({ data: consultationForm } as never);
    vi.mocked(fetchCurrentPatient).mockResolvedValue(patient);
  });

  it("opens the row's consultation for editing in a workspace on the waiting list, without leaving it", async () => {
    render(<WaitingList />);

    await openFormOf('rhd00003');

    await waitFor(() => expect(vi.mocked(launchWorkspace2)).toHaveBeenCalled());
    const [workspace, workspaceProps, windowProps] = vi.mocked(launchWorkspace2).mock.calls[0];
    expect(workspace).toBe('act-waiting-list-form-entry-workspace');
    expect(workspaceProps).toEqual(expect.objectContaining({ form: consultationForm, encounterUuid: 'encounter-3' }));
    expect(windowProps).toEqual(expect.objectContaining({ patient, patientUuid: 'patient-3', visitContext: null }));
    expect(vi.mocked(fetchCurrentPatient)).toHaveBeenCalledWith('patient-3');
    expect(vi.mocked(navigate)).not.toHaveBeenCalled();
  });

  it('evaluates the waiting list again once the consultation is saved, so the row shows the change', async () => {
    render(<WaitingList />);
    await openFormOf('rhd00003');
    await waitFor(() => expect(vi.mocked(launchWorkspace2)).toHaveBeenCalled());
    const [, workspaceProps, windowProps] = vi.mocked(launchWorkspace2).mock.calls[0] as [
      string,
      { handlePostResponse: () => void },
      { mutateVisitContext: () => void },
    ];

    workspaceProps.handlePostResponse();
    expect(mutate).toHaveBeenCalledTimes(1);
    // An HTML form reports its save only through the visit context.
    windowProps.mutateVisitContext();
    expect(mutate).toHaveBeenCalledTimes(2);
  });

  it('says so, and opens nothing, when the patient cannot be loaded', async () => {
    vi.mocked(fetchCurrentPatient).mockRejectedValue(new Error('forbidden'));
    render(<WaitingList />);

    await openFormOf('rhd00003');

    await waitFor(() =>
      expect(vi.mocked(showSnackbar)).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'error', subtitle: 'forbidden' }),
      ),
    );
    expect(vi.mocked(launchWorkspace2)).not.toHaveBeenCalled();
  });

  it('says so, and opens nothing, when the form cannot be loaded', async () => {
    vi.mocked(openmrsFetch).mockRejectedValue(new Error('not found'));
    render(<WaitingList />);

    await openFormOf('rhd00003');

    await waitFor(() =>
      expect(vi.mocked(showSnackbar)).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'error', subtitle: 'not found' }),
      ),
    );
    expect(vi.mocked(launchWorkspace2)).not.toHaveBeenCalled();
  });
});
