import React, { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getGlobalStore, launchWorkspace2, navigate, openmrsFetch, showSnackbar } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { useReportDataset } from '../reports/report-dataset.resource';
import { waitingListRows } from './waiting-list.fixture';
import WaitingList from './waiting-list.component';
import OpenPendingForm from './open-pending-form.component';

vi.mock('../reports/report-dataset.resource', () => ({ useReportDataset: vi.fn() }));

const consultationForm = { uuid: '4b063fc7-996f-3001-8500-8940e201be8f', name: 'RHD Consultation Visit' };
const workspaces = getGlobalStore<{ openedGroup: { groupName: string; props: Record<string, unknown> } | null }>(
  'workspace2',
  { openedGroup: null },
);

function openGroup(groupName: string, patientUuid: string) {
  act(() => workspaces.setState({ openedGroup: { groupName, props: { patientUuid } } }));
}

describe('Opening a recommendation consultation from the waiting list', () => {
  beforeEach(async () => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    window.history.replaceState(null, '', '/openmrs/spa/home/act-waiting-list');
    window.sessionStorage.clear();
    act(() => workspaces.setState({ openedGroup: null }));
    await signInWith(['View Patient Flags']);
    vi.mocked(useReportDataset).mockReturnValue({
      columns: [],
      rows: waitingListRows,
      isLoading: false,
      error: undefined,
    });
    vi.mocked(openmrsFetch).mockResolvedValue({ data: consultationForm } as never);
  });

  it("goes to the patient's chart from a row's Open form", async () => {
    render(<WaitingList />);

    await userEvent.click(
      within(screen.getByRole('row', { name: /rhd00003\b/ })).getByRole('button', { name: 'Open form' }),
    );

    expect(vi.mocked(navigate)).toHaveBeenCalledWith({ to: '${openmrsSpaBase}/patient/patient-3/chart' });
  });

  it("opens the row's consultation for editing once the chart has opened its workspaces for that patient", async () => {
    render(<WaitingList />);
    await userEvent.click(
      within(screen.getByRole('row', { name: /rhd00003\b/ })).getByRole('button', { name: 'Open form' }),
    );
    render(<OpenPendingForm />);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(vi.mocked(launchWorkspace2)).not.toHaveBeenCalled();

    openGroup('patient-chart', 'patient-3');

    await waitFor(() =>
      expect(vi.mocked(launchWorkspace2)).toHaveBeenCalledWith('patient-form-entry-workspace', {
        form: consultationForm,
        encounterUuid: 'encounter-3',
      }),
    );
    expect(vi.mocked(openmrsFetch).mock.calls[0][0]).toContain(`/form/${consultationForm.uuid}`);
    openGroup('patient-chart', 'patient-3');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(vi.mocked(launchWorkspace2)).toHaveBeenCalledTimes(1);
  });

  it("does not open it in another patient's chart", async () => {
    render(<WaitingList />);
    await userEvent.click(
      within(screen.getByRole('row', { name: /rhd00003\b/ })).getByRole('button', { name: 'Open form' }),
    );
    render(<OpenPendingForm />);

    openGroup('patient-chart', 'patient-9');
    openGroup('patient-chart', 'patient-3');

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(vi.mocked(launchWorkspace2)).not.toHaveBeenCalled();
  });

  it("waits for the patient chart's own workspaces, not another app's for the same patient", async () => {
    render(<WaitingList />);
    await userEvent.click(
      within(screen.getByRole('row', { name: /rhd00003\b/ })).getByRole('button', { name: 'Open form' }),
    );
    render(<OpenPendingForm />);

    openGroup('ward-patient', 'patient-3');

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(vi.mocked(launchWorkspace2)).not.toHaveBeenCalled();
    openGroup('patient-chart', 'patient-3');
    await waitFor(() => expect(vi.mocked(launchWorkspace2)).toHaveBeenCalledTimes(1));
  });

  it('says so in the chart when the consultation form cannot be fetched', async () => {
    vi.mocked(openmrsFetch).mockRejectedValue(new Error('Server responded with 404'));
    render(<WaitingList />);
    await userEvent.click(
      within(screen.getByRole('row', { name: /rhd00003\b/ })).getByRole('button', { name: 'Open form' }),
    );
    render(<OpenPendingForm />);

    openGroup('patient-chart', 'patient-3');

    await waitFor(() =>
      expect(vi.mocked(showSnackbar)).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'error',
          title: 'Could not open the form',
          subtitle: 'Server responded with 404',
        }),
      ),
    );
    expect(vi.mocked(launchWorkspace2)).not.toHaveBeenCalled();
  });

  it('does nothing in a chart opened without Open form', async () => {
    render(<OpenPendingForm />);

    openGroup('patient-chart', 'patient-3');

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(vi.mocked(launchWorkspace2)).not.toHaveBeenCalled();
  });

  it('forgets an Open form whose chart did not open within a minute', async () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    render(<WaitingList />);
    await userEvent.click(
      within(screen.getByRole('row', { name: /rhd00003\b/ })).getByRole('button', { name: 'Open form' }),
    );
    clock.mockReturnValue(now + 61_000);
    render(<OpenPendingForm />);

    openGroup('patient-chart', 'patient-3');

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(vi.mocked(launchWorkspace2)).not.toHaveBeenCalled();
    clock.mockRestore();
  });
});
