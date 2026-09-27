import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { showSnackbar } from '@openmrs/esm-framework';
import { fetchForm, type FlagGap, useFlagGaps } from './flag-gaps.resource';
import FlagGapsWorkspace, { daysPending, type FlagActionWorkspaceProps } from './flag-gaps.workspace';

vi.mock('./flag-gaps.resource', () => ({
  useFlagGaps: vi.fn(),
  fetchForm: vi.fn(),
}));

const mockUseFlagGaps = vi.mocked(useFlagGaps);
const mockFetchForm = vi.mocked(fetchForm);

const workspaceProps: FlagActionWorkspaceProps = {
  patientUuid: 'patient-uuid',
  patientFlagUuid: 'patient-flag-uuid',
  flagUuid: 'flag-uuid',
  flagName: 'RHD perfusion issues not recorded',
};

const firstGap: FlagGap = {
  encounter: 'encounter-1',
  encounterDatetime: '2026-09-10T09:00:00.000+0000',
  form: { uuid: 'form-uuid', display: 'Procedures and Outcomes' },
  concept: { uuid: 'perfusion-uuid', display: 'Perfusion Issues' },
};

const secondGap: FlagGap = { ...firstGap, encounter: 'encounter-2', encounterDatetime: '2026-09-20T10:30:00.000+0000' };

function showWorkspace(launchChildWorkspace = vi.fn()) {
  render(
    <FlagGapsWorkspace
      workspaceProps={workspaceProps}
      windowProps={null}
      groupProps={null}
      launchChildWorkspace={launchChildWorkspace}
      closeWorkspace={vi.fn()}
      workspaceName="rhd-flag-gaps-workspace"
      windowName="patient-chart-clinical-forms"
      isRootWorkspace
      showActionMenu={false}
    />,
  );
  return launchChildWorkspace;
}

function gapsReturned(overrides: Partial<ReturnType<typeof useFlagGaps>>) {
  mockUseFlagGaps.mockReturnValue({ gaps: [], configured: true, isLoading: false, error: undefined, ...overrides });
}

describe('flag gaps workspace', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-25T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('asks for the gaps of the clicked flag for the patient', () => {
    gapsReturned({});

    showWorkspace();

    expect(mockUseFlagGaps).toHaveBeenCalledWith('patient-uuid', 'flag-uuid');
    expect(screen.getByText('RHD perfusion issues not recorded')).toBeInTheDocument();
  });

  it('lists one row per gap with its form, question and days pending', () => {
    gapsReturned({ gaps: [firstGap, secondGap] });

    showWorkspace();

    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveTextContent('Procedures and Outcomes');
    expect(rows[1]).toHaveTextContent('Perfusion Issues');
    expect(rows[1]).toHaveTextContent('15');
    expect(rows[2]).toHaveTextContent('5');
  });

  it("opens the gap's encounter in the form entry workspace", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const form = { uuid: 'form-uuid', name: 'Procedures and Outcomes' };
    mockFetchForm.mockResolvedValue(form);
    gapsReturned({ gaps: [firstGap, secondGap] });

    const launchChildWorkspace = showWorkspace();
    await user.click(screen.getAllByRole('button', { name: /open form/i })[1]);

    expect(mockFetchForm).toHaveBeenCalledWith('form-uuid');
    expect(launchChildWorkspace).toHaveBeenCalledWith('patient-form-entry-workspace', {
      form,
      encounterUuid: 'encounter-2',
    });
  });

  it('says so when the form cannot be opened', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockFetchForm.mockRejectedValue(new Error('forbidden'));
    gapsReturned({ gaps: [firstGap] });

    const launchChildWorkspace = showWorkspace();
    await user.click(screen.getByRole('button', { name: /open form/i }));

    expect(launchChildWorkspace).not.toHaveBeenCalled();
    expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'error', subtitle: 'forbidden' }));
  });

  it('offers no way to open a gap whose form the user may not see', () => {
    gapsReturned({ gaps: [{ ...firstGap, form: null }] });

    showWorkspace();

    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /open form/i })).not.toBeInTheDocument();
  });

  it('says so when the flag does not list its missing data', () => {
    gapsReturned({ configured: false });

    showWorkspace();

    expect(screen.getByText(/does not list its missing data/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('says so when nothing is missing', () => {
    gapsReturned({ gaps: [] });

    showWorkspace();

    expect(screen.getByText(/nothing is missing/i)).toBeInTheDocument();
  });

  it('says so when the gaps cannot be loaded', () => {
    gapsReturned({ error: new Error('Privilege required: View Patient Flags') });

    showWorkspace();

    expect(screen.getByText(/could not load the missing data/i)).toBeInTheDocument();
    expect(screen.getByText(/privilege required/i)).toBeInTheDocument();
  });
});

describe('daysPending', () => {
  it('counts whole days since the encounter', () => {
    expect(daysPending('2026-09-10T09:00:00.000+0000', new Date('2026-09-25T08:59:00.000Z'))).toBe(14);
    expect(daysPending('2026-09-10T09:00:00.000+0000', new Date('2026-09-25T09:00:00.000Z'))).toBe(15);
  });
});
