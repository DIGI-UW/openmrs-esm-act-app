import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import {
  closeWorkspaceGroup2,
  fetchCurrentPatient,
  launchWorkspace2,
  openmrsFetch,
  useSession,
} from '@openmrs/esm-framework';
import { atSessionLocation, signInWith } from '../access/sign-in.test-helper';
import { fetchForm } from '../flag-gaps/flag-gaps.resource';
import { findActiveVisit } from '../visits/start-visit';
import { dueRows } from './due-for-prophylaxis.fixture';
import DueForProphylaxis from './due-for-prophylaxis.component';

vi.mock('../access/may-enter-form', () => ({
  MayEnterForm: ({ children }: { children: React.ReactNode }) => children,
  useMayEnterForm: () => true,
}));
vi.mock('../visits/start-visit', () => ({ findActiveVisit: vi.fn(), startVisit: vi.fn() }));
vi.mock('../flag-gaps/flag-gaps.resource', () => ({ fetchForm: vi.fn() }));
vi.mock('@openmrs/esm-framework', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchCurrentPatient: vi.fn(),
}));

const dueReport = '/reportingrest/reportdata/f3d8b672-a8a3-47a3-8a0b-dff01de6e3a8';
const reportFetches = () => vi.mocked(openmrsFetch).mock.calls.filter(([url]) => String(url).includes(dueReport));

/** Reads `served.rows` on each request, so the test can change what the next fetch returns. */
function serveReport(served: { rows: Array<Record<string, unknown>> }) {
  vi.mocked(openmrsFetch).mockImplementation(((url: string) =>
    Promise.resolve({
      data: String(url).includes(dueReport) ? { dataSets: [{ metadata: { columns: [] }, rows: served.rows }] } : {},
    })) as never);
}

describe('Recording a dose from the due list', () => {
  beforeEach(async () => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    await signInWith(['App: act.dueList', 'Add Encounters']);
    vi.mocked(useSession).mockReturnValue({
      authenticated: true,
      sessionId: 'session',
      sessionLocation: { uuid: 'clinic', display: 'Kiswa HC III' },
    } as never);
    vi.mocked(fetchForm).mockImplementation((uuid: string) => Promise.resolve({ uuid }) as never);
    vi.mocked(fetchCurrentPatient).mockImplementation((uuid: string) => Promise.resolve({ id: uuid }) as never);
    vi.mocked(findActiveVisit).mockResolvedValue({ uuid: 'active-visit' } as never);
    vi.mocked(launchWorkspace2).mockResolvedValue(true);
    vi.mocked(closeWorkspaceGroup2).mockResolvedValue(true);
  });

  it('reloads the list once the form is saved, so a patient whose next dose moved on leaves it', async () => {
    const served = { rows: dueRows };
    serveReport(served);
    // A location of no clinic kind, so every patient on the report is listed.
    atSessionLocation('Kiswa HC III', [], 'clinic');
    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <DueForProphylaxis />
      </SWRConfig>,
    );

    await userEvent.click(within(await screen.findByRole('row', { name: /rhd00012/ })).getByRole('button'));
    await waitFor(() => expect(launchWorkspace2).toHaveBeenCalled());
    const fetchesBefore = reportFetches().length;
    const { handlePostResponse } = vi.mocked(launchWorkspace2).mock.calls[0][1] as {
      handlePostResponse: (encounter: unknown) => void;
    };

    served.rows = dueRows.filter((row) => row.patient_uuid !== 'patient-overdue');
    // Passed the saved encounter, as the workspace does, which mutate must not store as the report's rows.
    await act(async () => handlePostResponse({ uuid: 'saved-encounter' }));

    await waitFor(() => expect(screen.queryByRole('row', { name: /rhd00012/ })).not.toBeInTheDocument());
    expect(reportFetches().length).toBeGreaterThan(fetchesBefore);
    // The rest of the list is still there, not replaced by the encounter the workspace passed.
    expect(screen.getByRole('row', { name: /rhd00052/ })).toBeInTheDocument();
  });
});
