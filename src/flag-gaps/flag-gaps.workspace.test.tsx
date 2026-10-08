import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getDefaultsFromConfigSchema, showSnackbar, useConfig } from '@openmrs/esm-framework';
import { type Config, configSchema } from '../config-schema';
import { fetchForm, type FlagGap, type FlagGaps, usePatientFlagGaps } from './flag-gaps.resource';
import FlagGapsWorkspace, { daysPending, type FlagActionWorkspaceProps } from './flag-gaps.workspace';
import { layouts, setLayout, tableSkeleton } from '../table-skeleton.test-helper';
import { useOpenFormInVisit } from '../visits/open-form-in-visit';

// Who may record a form is may-enter-form's own test; here every form may be recorded.
vi.mock('../access/may-enter-form', () => ({
  MayEnterForm: ({ children }: { children: React.ReactNode }) => children,
  useMayEnterForm: () => true,
}));
vi.mock('./flag-gaps.resource', () => ({
  usePatientFlagGaps: vi.fn(),
  fetchForm: vi.fn(),
}));
// Starting a visit for a new form is open-form-in-visit's own test; here the opener is watched.
vi.mock('../visits/open-form-in-visit', () => ({ useOpenFormInVisit: vi.fn() }));

const mockUsePatientFlagGaps = vi.mocked(usePatientFlagGaps);
const mockFetchForm = vi.mocked(fetchForm);
const openNewForm = vi.fn();

// The flag the default configuration maps to a form, and that form.
const prophylaxisFlag = 'b1f7a2c0-0005-4a00-9000-000000000005';
const consultationForm = { uuid: '4b063fc7-996f-3001-8500-8940e201be8f', display: 'RHD Consultation Visit' };

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

function showWorkspace(
  launchChildWorkspace = vi.fn(),
  props: Partial<FlagActionWorkspaceProps> | null = workspaceProps,
) {
  render(
    <FlagGapsWorkspace
      workspaceProps={props}
      windowProps={null}
      groupProps={{ patientUuid: 'patient-uuid' }}
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

function flagWith(gaps: Array<FlagGap>, overrides: Partial<FlagGaps> = {}): FlagGaps {
  return { flagUuid: 'flag-uuid', flagName: 'RHD perfusion issues not recorded', configured: true, gaps, ...overrides };
}

function flagsReturned(flagGaps: Array<FlagGaps>, overrides: Partial<ReturnType<typeof usePatientFlagGaps>> = {}) {
  mockUsePatientFlagGaps.mockReturnValue({ flagGaps, isLoading: false, error: undefined, ...overrides });
}

// The clicked flag's gaps, as the lookup returns them for one flag.
function gapsReturned({
  gaps = [],
  configured = true,
  error,
}: {
  gaps?: Array<FlagGap>;
  configured?: boolean;
  error?: Error;
}) {
  flagsReturned(error ? [] : [flagWith(gaps, { configured })], { error });
}

beforeEach(() => {
  vi.mocked(useConfig<Config>).mockReturnValue(getDefaultsFromConfigSchema(configSchema) as Config);
  vi.mocked(useOpenFormInVisit).mockReturnValue({ open: openNewForm, isOpening: false });
});

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

    expect(mockUsePatientFlagGaps).toHaveBeenCalledWith('patient-uuid', {
      uuid: 'flag-uuid',
      name: 'RHD perfusion issues not recorded',
    });
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

  it('offers the form configured for a flag that does not list its missing data, such as a risk flag', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockFetchForm.mockReturnValue(new Promise(() => undefined));
    vi.mocked(useConfig<Config>).mockReturnValue({
      ...(getDefaultsFromConfigSchema(configSchema) as Config),
      flagLists: {
        ...(getDefaultsFromConfigSchema(configSchema) as Config).flagLists,
        flagForms: [{ flag: 'overdue-uuid', form: 'bpg-form-uuid', concept: 'injection-date-uuid' }],
      },
    });
    flagsReturned([flagWith([], { flagUuid: 'overdue-uuid', flagName: 'RHD prophylaxis overdue', configured: false })]);

    showWorkspace(vi.fn(), { ...workspaceProps, flagUuid: 'overdue-uuid', flagName: 'RHD prophylaxis overdue' });
    expect(screen.queryByText(/does not list its missing data/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open form' }));

    expect(openNewForm).toHaveBeenCalledWith('bpg-form-uuid', 'injection-date-uuid');
  });

  it('offers a new form when no saved form is waiting to be completed', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    gapsReturned({ gaps: [] });

    const launchChildWorkspace = showWorkspace();
    expect(screen.getByText(/no saved form is waiting to be completed/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /open clinical forms/i }));

    expect(launchChildWorkspace).toHaveBeenCalledWith('clinical-forms-workspace');
  });

  it('offers the form configured for the flag as a new form, in the visit, at the missing question', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockFetchForm.mockResolvedValue(consultationForm);
    flagsReturned([flagWith([], { flagUuid: prophylaxisFlag, flagName: 'RHD prophylaxis not prescribed' })]);

    const launchChildWorkspace = showWorkspace(vi.fn(), { ...workspaceProps, flagUuid: prophylaxisFlag });
    await user.click(await screen.findByRole('button', { name: 'Open RHD Consultation Visit' }));

    expect(useOpenFormInVisit).toHaveBeenCalledWith('patient-uuid', launchChildWorkspace);
    expect(openNewForm).toHaveBeenCalledWith(consultationForm.uuid, '668e0221-8b41-5669-9ad8-78e193d42494');
    expect(launchChildWorkspace).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /open clinical forms/i })).not.toBeInTheDocument();
  });

  it('opens a configured form without a question at the top, and names it Open form until it loads', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockFetchForm.mockReturnValue(new Promise(() => undefined));
    vi.mocked(useConfig<Config>).mockReturnValue({
      ...(getDefaultsFromConfigSchema(configSchema) as Config),
      flagLists: {
        ...(getDefaultsFromConfigSchema(configSchema) as Config).flagLists,
        flagForms: [{ flag: 'flag-uuid', form: 'form-uuid', concept: '' }],
      },
    });
    gapsReturned({ gaps: [] });

    showWorkspace();
    await user.click(screen.getByRole('button', { name: 'Open form' }));

    expect(openNewForm).toHaveBeenCalledWith('form-uuid', undefined);
  });

  it("lists the gaps behind each of the patient's flags when not told which flag was clicked", () => {
    const sepsis = { ...firstGap, concept: { uuid: 'sepsis-uuid', display: 'Bacterial Sepsis' } };
    flagsReturned([
      flagWith([firstGap]),
      flagWith([], { flagUuid: 'overdue-uuid', flagName: 'RHD prophylaxis overdue', configured: false }),
      flagWith([sepsis], { flagUuid: 'sepsis-flag-uuid', flagName: 'RHD bacterial sepsis not recorded' }),
    ]);

    showWorkspace(vi.fn(), null);

    expect(mockUsePatientFlagGaps).toHaveBeenCalledWith('patient-uuid', undefined);
    expect(screen.getByText('Missing data')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'RHD perfusion issues not recorded' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'RHD bacterial sepsis not recorded' })).toBeInTheDocument();
    expect(screen.queryByText('RHD prophylaxis overdue')).not.toBeInTheDocument();
    expect(screen.getAllByRole('table')).toHaveLength(2);
    expect(screen.getByText('Bacterial Sepsis')).toBeInTheDocument();
  });

  it("says so when none of the patient's flags lists its missing data", () => {
    flagsReturned([flagWith([], { configured: false })]);

    showWorkspace(vi.fn(), null);

    expect(screen.getByText(/none of this patient's flags lists its missing data/i)).toBeInTheDocument();
  });

  it('says so when the gaps cannot be loaded', () => {
    gapsReturned({ error: new Error('Privilege required: View Patient Flags') });

    showWorkspace();

    expect(screen.getByText(/could not load the missing data/i)).toBeInTheDocument();
    expect(screen.getByText(/privilege required/i)).toBeInTheDocument();
  });
});

describe('daysPending', () => {
  it.each(layouts)(
    'loads as a table skeleton of its columns, compact as its table on $layout',
    ({ layout, compact }) => {
      setLayout(layout);
      flagsReturned([], { isLoading: true });

      showWorkspace();

      const { skeleton, columns } = tableSkeleton();
      expect(columns).toBe(5);
      expect(skeleton.className.includes('cds--data-table--compact')).toBe(compact);
    },
  );

  it.each(layouts)('lists the gaps in a $size table on $layout', ({ layout, size }) => {
    setLayout(layout);
    gapsReturned({ gaps: [firstGap] });

    showWorkspace();

    expect(screen.getByRole('table')).toHaveClass(`cds--data-table--${size}`);
  });

  it('counts whole days since the encounter', () => {
    expect(daysPending('2026-09-10T09:00:00.000+0000', new Date('2026-09-25T08:59:00.000Z'))).toBe(14);
    expect(daysPending('2026-09-10T09:00:00.000+0000', new Date('2026-09-25T09:00:00.000Z'))).toBe(15);
  });
});
