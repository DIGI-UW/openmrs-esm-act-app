import React from 'react';
import dayjs from 'dayjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  type AssignedExtension,
  Extension,
  ExtensionSlot,
  getDefaultsFromConfigSchema,
  navigate,
  useAssignedExtensions,
} from '@openmrs/esm-framework';
import { homePrivilege, signInWith } from '../access/sign-in.test-helper';
import WorklistTiles from '../act-home/worklist-tiles.component';
import { type Config, configSchema } from '../config-schema';
import { useDueList } from '../due-for-prophylaxis/due-for-prophylaxis.resource';
import { useReportDataset } from '../reports/report-dataset.resource';
import { useRhdFlagList } from '../rhd-flags/rhd-flag-lists.resource';
import { downloadCsv } from '../table-filters/csv';
import ConfirmatoryEchoWorklist from './confirmatory-echo-worklist.component';
import DueForProphylaxisWorklist from './due-for-prophylaxis-worklist.component';
import FlagWorklist from './flag-worklist.component';
import { flagWorklists } from './flag-worklists';
import WaitingListWorklist from './waiting-list-worklist.component';
import { type WorklistState } from './worklist.component';
import Worklists from './worklists.component';

// Who may record a form is may-enter-form's own test; here every form may be recorded.
vi.mock('../access/may-enter-form', () => ({
  MayEnterForm: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('../reports/report-dataset.resource', () => ({ useReportDataset: vi.fn() }));
// The two pages' own tables are their pages' tests; here it matters only that the worklist shows them.
vi.mock('../waiting-list/waiting-list.component', () => ({
  WaitingListTable: () => <div data-testid="waiting-list-table" />,
}));
vi.mock('../screen-positive/screen-positive.component', () => ({
  ScreenPositiveTable: () => <div data-testid="screen-positive-table" />,
}));
vi.mock('../rhd-flags/rhd-flag-lists.resource', () => ({ useRhdFlagList: vi.fn() }));
vi.mock('../due-for-prophylaxis/due-for-prophylaxis.resource', () => ({ useDueList: vi.fn() }));
vi.mock('../table-filters/csv', () => ({ downloadCsv: vi.fn() }));

const worklistsPrivilege = 'App: act.worklists';

beforeEach(() => {
  window.getOpenmrsSpaBase = () => '/openmrs/spa/';
});
const tile: WorklistState = { view: 'tile', to: '/worklists?list=this' };
const list: WorklistState = { view: 'list' };

const registryRow = (i: number, flags = '', flagDates = '') => ({
  rhd_id: `rhd0000${i}`,
  full_name: `Patient ${i}`,
  sex: i % 2 ? 'M' : 'F',
  age_years: 10 + i,
  diagnosis_category: 'Rheumatic Heart Disease/Rheumatic Fever',
  diagnosis_details: 'RHD B',
  prophylaxis_regimen: 'Q28 day BPG',
  patient_uuid: `patient-${i}`,
  rhd_flags: flags,
  rhd_flag_dates: flagDates,
});

type Report = 'registry' | 'due' | 'screenPositive' | 'waitingList';

/** Each report's rows, found by the report the default config names. */
function reports(rowsByReport: Partial<Record<Report, Array<Record<string, unknown>>>>) {
  const config = getDefaultsFromConfigSchema(configSchema) as Config;
  const reportKeys: Record<string, Report> = {
    [config.registry.report]: 'registry',
    [config.dueForProphylaxis.report]: 'due',
    [config.screenPositive.report]: 'screenPositive',
    [config.waitingList.report]: 'waitingList',
  };
  vi.mocked(useReportDataset).mockImplementation((report) => ({
    columns: [],
    rows: rowsByReport[reportKeys[report]] ?? [],
    isLoading: false,
    error: undefined,
    mutate: vi.fn(),
  }));
}

/** The table's rows, each cell's text but the action's. */
const tableRows = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole('cell')
        .slice(0, -1)
        .map((cell) => cell.textContent),
    );

/** The state the slot's children function gives the worklist with this id. */
function stateFor({ children }: { children?: unknown }, id: string) {
  vi.mocked(Extension).mockClear();
  render(<>{(children as (extension: AssignedExtension) => React.ReactNode)({ id } as AssignedExtension)}</>);
  return vi.mocked(Extension).mock.lastCall[0].state as unknown as WorklistState;
}

describe('Worklists page', () => {
  const worklists = [{ id: 'act-worklist-due-for-prophylaxis' }, { id: 'act-worklist-lost-to-follow-up' }];
  const choices = () => vi.mocked(ExtensionSlot).mock.calls.find(([props]) => typeof props?.children === 'function')[0];
  const shownList = () => vi.mocked(ExtensionSlot).mock.calls.find(([props]) => props?.select)[0];

  beforeEach(async () => {
    window.history.replaceState(null, '', '/openmrs/spa/home/act-worklists');
    vi.mocked(ExtensionSlot).mockClear();
    await signInWith([worklistsPrivilege]);
    vi.mocked(useAssignedExtensions).mockReturnValue(worklists as Array<AssignedExtension>);
  });

  it('shows each worklist in the slot as a choice, the first chosen, and the chosen one under them', () => {
    render(<Worklists />);

    expect(choices().name).toBe('act-worklists-slot');
    expect(stateFor(choices(), 'act-worklist-due-for-prophylaxis')).toMatchObject({
      view: 'choice',
      selected: true,
    });
    expect(stateFor(choices(), 'act-worklist-lost-to-follow-up')).toMatchObject({
      view: 'choice',
      selected: false,
    });
    expect(shownList()).toMatchObject({ name: 'act-worklists-slot', state: { view: 'list' } });
    expect(shownList().select(worklists as Array<AssignedExtension>)).toEqual([worklists[0]]);
  });

  it('chooses the worklist the URL names, and writes the one chosen to the URL', async () => {
    window.history.replaceState(null, '', '/openmrs/spa/home/act-worklists?list=act-worklist-lost-to-follow-up');

    render(<Worklists />);

    expect(shownList().select(worklists as Array<AssignedExtension>)).toEqual([worklists[1]]);
    stateFor(choices(), 'act-worklist-due-for-prophylaxis').onSelect();
    await waitFor(() => expect(window.location.search).toBe('?list=act-worklist-due-for-prophylaxis'));
  });

  it('says so when no worklist is assigned to the slot', () => {
    vi.mocked(useAssignedExtensions).mockReturnValue([]);

    render(<Worklists />);

    expect(screen.getByText('No worklists have been added yet.')).toBeInTheDocument();
  });
});

describe("ACT home's Worklists", () => {
  it('shows each worklist as a tile opening the Worklists page on it', async () => {
    await signInWith([homePrivilege, worklistsPrivilege]);

    render(<WorklistTiles />);

    expect(screen.getByRole('heading', { name: 'Worklists' })).toBeInTheDocument();
    const [props] = vi.mocked(ExtensionSlot).mock.lastCall;
    expect(props.name).toBe('act-worklists-slot');
    expect(stateFor(props, 'act-worklist-x')).toEqual({
      view: 'tile',
      to: '${openmrsSpaBase}/home/act-worklists?list=act-worklist-x',
    });
  });
});

describe('Flag worklist', () => {
  beforeEach(async () => {
    await signInWith(
      [worklistsPrivilege, 'Task: act.lists.export'],
      flagWorklists['act-worklist-lost-to-follow-up'] as unknown as Partial<Config>,
    );
    vi.mocked(useRhdFlagList).mockReturnValue({
      list: { cohortUuid: 'cohort' },
      isLoading: false,
      error: undefined,
    });
  });

  it('counts on a red tile the registry patients its list shows, linking where the slot says', () => {
    reports({
      registry: [
        registryRow(1, 'RHD lost to follow-up'),
        registryRow(2, 'RHD INR target missing'),
        registryRow(3, 'RHD INR target missing|RHD lost to follow-up'),
      ],
    });

    render(<FlagWorklist {...tile} />);

    expect(vi.mocked(useRhdFlagList)).toHaveBeenCalledWith('RHD lost to follow-up');
    expect(screen.getByTestId('worklist-tile')).toHaveTextContent('2Lost to follow-up');
    expect(screen.getByTestId('worklist-tile')).toHaveAttribute('data-tone', 'red');
    expect(screen.getByRole('link')).toHaveAttribute('href', '/worklists?list=this');
  });

  it('is a button that chooses it, pressed when chosen, on the Worklists page', async () => {
    reports({});
    const onSelect = vi.fn();
    render(<FlagWorklist view="choice" selected onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('button', { name: /Lost to follow-up/ }));

    expect(screen.getByRole('button', { name: /Lost to follow-up/ })).toHaveAttribute('aria-pressed', 'true');
    expect(onSelect).toHaveBeenCalled();
  });

  it('shows nothing where ACT Core keeps no list for its flag', () => {
    vi.mocked(useRhdFlagList).mockReturnValue({ list: null, isLoading: false, error: undefined });
    reports({});

    const { container } = render(<FlagWorklist {...tile} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('lists the registry patients on its flag, with how long they have been on it, and downloads them', async () => {
    const joined = dayjs().subtract(12, 'day').format('YYYY-MM-DD');
    reports({
      registry: [
        registryRow(1, 'RHD lost to follow-up|RHD INR target missing', `RHD lost to follow-up=${joined}`),
        registryRow(2, 'RHD INR target missing'),
      ],
    });

    render(<FlagWorklist {...list} />);

    expect(screen.getByRole('heading', { name: 'Lost to follow-up' })).toBeInTheDocument();
    expect(tableRows()).toEqual([['Patient 1rhd00001', '11 M', 'RHD B', 'Q28 day BPG', 'On the list for 12 days']]);
    await userEvent.click(screen.getByRole('button', { name: 'Download CSV' }));
    expect(vi.mocked(downloadCsv)).toHaveBeenCalledWith(
      expect.stringMatching(/^rhd-lost-to-follow-up-/),
      ['Patient', 'ACT ID', 'Age, sex', 'Diagnosis', 'Prophylaxis', 'Why on this list'],
      [['Patient 1', 'rhd00001', '11 M', 'RHD B', 'Q28 day BPG', 'On the list for 12 days']],
    );
  });

  it('opens the patient chart from a row', async () => {
    reports({ registry: [registryRow(1, 'RHD lost to follow-up')] });

    render(<FlagWorklist {...list} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open chart' }));

    expect(vi.mocked(navigate)).toHaveBeenCalledWith({ to: '${openmrsSpaBase}/patient/patient-1/chart' });
  });

  it('says so when its flag has no patients on the registry', () => {
    reports({ registry: [registryRow(2)] });

    render(<FlagWorklist {...list} />);

    expect(screen.getByTestId('table-empty-state')).toHaveTextContent('There are no patients on this list to display');
  });
});

describe('Cardiology follow-up worklist', () => {
  it('says each patient is overdue since, or due by, their next review date, a patient due today not yet overdue', async () => {
    await signInWith(
      [worklistsPrivilege],
      flagWorklists['act-worklist-cardiology-follow-up'] as unknown as Partial<Config>,
    );
    const flag = 'RHD cardiology follow-up due';
    vi.mocked(useRhdFlagList).mockReturnValue({
      list: { cohortUuid: 'cohort' },
      isLoading: false,
      error: undefined,
    });
    reports({
      registry: [
        { ...registryRow(1, flag), next_consultation_date: dayjs().subtract(9, 'day').format('YYYY-MM-DD') },
        { ...registryRow(2, flag), next_consultation_date: dayjs().add(5, 'day').format('YYYY-MM-DD') },
        { ...registryRow(3, flag), next_consultation_date: dayjs().format('YYYY-MM-DD') },
      ],
    });

    render(<FlagWorklist {...list} />);

    expect(vi.mocked(useRhdFlagList)).toHaveBeenCalledWith(flag);
    expect(tableRows().map((row) => row[4])).toEqual([
      expect.stringMatching(/^Overdue · was due \S/),
      expect.stringMatching(/^Due \S/),
      expect.stringMatching(/^Due \S/),
    ]);
  });
});

describe('Due for prophylaxis worklist', () => {
  const dueRow = (i: number, status: string, nextDue: string, type = 'BPG') => ({
    patient_uuid: `patient-${i}`,
    full_name: `Patient ${i}`,
    rhd_id: `rhd0000${i}`,
    prophylaxis_type: type,
    injection_interval_days: type === 'BPG' ? 28 : null,
    regimen: type === 'BPG' ? null : 'Penicillin V',
    next_due: nextDue,
    status,
  });
  const dueRows = [
    dueRow(1, 'due_today', '2026-08-29'),
    dueRow(2, 'overdue', '2026-08-21'),
    dueRow(3, 'due_soon', '2026-08-30', 'Oral'),
  ];

  beforeEach(async () => {
    await signInWith([worklistsPrivilege, 'Add Encounters']);
    reports({ registry: [registryRow(1), registryRow(2)], due: dueRows });
    vi.mocked(useDueList).mockReturnValue({
      rows: dueRows,
      recorded: new Set(['patient-1']),
      recordedError: undefined,
      checking: false,
      waiting: 1,
      isLoading: false,
      error: undefined,
    });
  });

  it('counts every patient due in the next 48 hours, due today or overdue, on a red tile', () => {
    render(<DueForProphylaxisWorklist {...tile} />);

    expect(screen.getByTestId('worklist-tile')).toHaveTextContent('3Due for prophylaxis');
    expect(screen.getByTestId('worklist-tile')).toHaveAttribute('data-tone', 'red');
  });

  it('lists them with their prescription and why they are due, to record the dose from', () => {
    render(<DueForProphylaxisWorklist {...list} />);

    const rows = tableRows();
    expect(rows[0]).toEqual(['Patient 1rhd00001', '11 M', 'RHD B', 'BPG · every 28 days', 'Recorded today']);
    expect(rows[1].slice(3)).toEqual(['BPG · every 28 days', expect.stringMatching(/^Overdue · was due \S/)]);
    // Not on the registry, so who they are comes from the due list.
    expect(rows[2]).toEqual(['Patient 3rhd00003', '', '', 'Penicillin V', expect.stringMatching(/^Due in 48 h · \S/)]);
    expect(screen.getByRole('link', { name: 'View chart' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Record BPG' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Record oral' })).toBeInTheDocument();
  });
});

describe('Confirmatory echo worklist', () => {
  beforeEach(async () => {
    await signInWith([worklistsPrivilege]);
    reports({ screenPositive: [{ ...registryRow(4), diagnosis_details: '', screen_date: '2026-08-02' }] });
  });

  it('counts the screen positive patients awaiting confirmation on an orange tile', () => {
    render(<ConfirmatoryEchoWorklist {...tile} />);

    expect(screen.getByTestId('worklist-tile')).toHaveTextContent('1Confirmatory echo due');
    expect(screen.getByTestId('worklist-tile')).toHaveAttribute('data-tone', 'orange');
  });

  it('chooses its list on the Worklists page for every user, rather than leaving it', async () => {
    await signInWith([worklistsPrivilege, 'App: act.screenPositive']);
    render(<ConfirmatoryEchoWorklist view="choice" onSelect={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Confirmatory echo due/ })).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('shows Confirmatory echo due itself, with Enter diagnosis, to a user who has that page', async () => {
    await signInWith([worklistsPrivilege, 'App: act.screenPositive']);
    render(<ConfirmatoryEchoWorklist {...list} />);

    expect(screen.getByRole('heading', { name: 'Confirmatory echo due' })).toBeInTheDocument();
    expect(screen.getByTestId('screen-positive-table')).toBeInTheDocument();
  });

  it('lists them with when they screened positive', () => {
    render(<ConfirmatoryEchoWorklist {...list} />);

    expect(tableRows()[0][0]).toBe('Patient 4rhd00004');
    expect(tableRows()[0][4]).toMatch(/^Screened positive · \S/);
  });
});

describe('Procedural waiting list worklist', () => {
  beforeEach(async () => {
    await signInWith([worklistsPrivilege, 'App: act.waitingList']);
    reports({ waitingList: [{ patient_uuid: 'patient-5' }, { patient_uuid: 'patient-6' }] });
  });

  it('shows the waiting list itself, with its filters and ranking, under its title', () => {
    render(<WaitingListWorklist {...list} />);

    expect(screen.getByRole('heading', { name: 'Procedural waiting list' })).toBeInTheDocument();
    expect(screen.getByTestId('waiting-list-table')).toBeInTheDocument();
  });

  it('chooses its list on the Worklists page, rather than leaving it', async () => {
    const onSelect = vi.fn();
    render(<WaitingListWorklist view="choice" onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('button', { name: /2\s*Procedural waiting list/ }));

    expect(onSelect).toHaveBeenCalled();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
