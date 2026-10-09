import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import { openmrsFetch, useSession } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { useReportDataset } from '../reports/report-dataset.resource';
import { downloadCsv } from '../table-filters/csv';
import { openFormInChart } from '../visits/open-form-in-chart';
import { useRecordedToday } from './recorded-today.resource';
import { dueRows, manyDueRows } from './due-for-prophylaxis.fixture';
import DueForProphylaxis from './due-for-prophylaxis.component';
import DueForProphylaxisWidget from './due-for-prophylaxis-widget.component';

// Who may record a form is may-enter-form's own test; here every form may be recorded.
vi.mock('../access/may-enter-form', () => ({
  MayEnterForm: ({ children }: { children: React.ReactNode }) => children,
  useMayEnterForm: () => true,
}));
vi.mock('../reports/report-dataset.resource', () => ({ useReportDataset: vi.fn() }));
vi.mock('../visits/open-form-in-chart', () => ({ openFormInChart: vi.fn() }));
vi.mock('./recorded-today.resource', () => ({ useRecordedToday: vi.fn() }));
vi.mock('../table-filters/csv', () => ({ downloadCsv: vi.fn() }));
const mockUseReportDataset = vi.mocked(useReportDataset);
const mockOpenFormInChart = vi.mocked(openFormInChart);
const mockUseRecordedToday = vi.mocked(useRecordedToday);
const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const bpgForm = '0119d2e6-e2e1-391c-9b88-d59a10b0780d';
const oralForm = 'ba29e982-ce18-302a-9fc4-d4b2c3983465';

function dataset(value: Partial<ReturnType<typeof useReportDataset>>) {
  mockUseReportDataset.mockReturnValue({
    columns: [],
    rows: [],
    isLoading: false,
    error: undefined,
    mutate: vi.fn(),
    ...value,
  });
}

function recorded(patientUuids: Array<string>) {
  mockUseRecordedToday.mockReturnValue({
    recorded: new Set(patientUuids),
    isLoading: false,
    isValidating: false,
    error: undefined,
  });
}

/** Shows every patient, not only those on BPG, the list's first choice. */
async function showAll() {
  await userEvent.click(screen.getByRole('tab', { name: /^All/ }));
}

function cells(name: RegExp) {
  return within(screen.getByRole('row', { name }))
    .getAllByRole('cell')
    .map((cell) => cell.textContent);
}

describe('Due for prophylaxis page', () => {
  beforeEach(async () => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    await signInWith(['App: act.dueList', 'Add Encounters']);
    vi.mocked(useSession).mockReturnValue({
      authenticated: true,
      sessionId: 'session',
      sessionLocation: { uuid: 'clinic', display: 'Kiswa HC III' },
    } as never);
    mockOpenFormInChart.mockReset();
    recorded([]);
  });

  it("lists each patient's prescription, last dose, status and adherence", async () => {
    dataset({ rows: dueRows });

    render(<DueForProphylaxis />);
    await showAll();

    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Patient',
      'ACT ID',
      'Prescription',
      'Last dose',
      'Status',
      'Adherence',
      '',
    ]);
    expect(cells(/rhd00012/)).toEqual([
      'Amina Nakato',
      'rhd00012',
      'BPG · every 28 days',
      '24-Aug-2026',
      'Overdue',
      '64%',
      'Record BPG',
    ]);
    expect(cells(/rhd00021/)).toEqual(['Joan Apio', 'rhd00021', 'Penicillin V', '', 'Due today', '70%', 'Record oral']);
    expect(cells(/rhd00052/)).toEqual([
      'Peter Mugisha',
      'rhd00052',
      'BPG · every 28 days',
      '26-Aug-2026',
      'Due in 48 h',
      '',
      'Record BPG',
    ]);
    expect(screen.getByRole('link', { name: 'Amina Nakato' })).toHaveAttribute(
      'href',
      '/openmrs/spa/patient/patient-overdue/chart',
    );
  });

  it('opens the BPG form in the chart from Record BPG, and the oral form from Record oral', async () => {
    dataset({ rows: dueRows });
    render(<DueForProphylaxis />);
    await showAll();

    await userEvent.click(within(screen.getByRole('row', { name: /rhd00012/ })).getByRole('button'));
    await userEvent.click(within(screen.getByRole('row', { name: /rhd00021/ })).getByRole('button'));

    expect(mockOpenFormInChart.mock.calls.map(([, options]) => options)).toEqual([
      expect.objectContaining({ patientUuid: 'patient-overdue', formUuid: bpgForm, location: 'clinic' }),
      expect.objectContaining({ patientUuid: 'patient-oral', formUuid: oralForm, location: 'clinic' }),
    ]);
  });

  it('opens one form at a time, so a second click cannot start a second visit', async () => {
    mockOpenFormInChart.mockReturnValue(new Promise(() => {}));
    dataset({ rows: dueRows });
    render(<DueForProphylaxis />);
    await showAll();

    const recordBpg = within(screen.getByRole('row', { name: /rhd00012/ })).getByRole('button');
    await userEvent.click(recordBpg);

    expect(recordBpg).toBeDisabled();
    expect(within(screen.getByRole('row', { name: /rhd00021/ })).getByRole('button')).toBeDisabled();
    expect(mockOpenFormInChart).toHaveBeenCalledTimes(1);
  });

  it('shows a patient recorded today as Recorded today, with View chart in place of Record', () => {
    dataset({ rows: dueRows });
    recorded(['patient-today']);

    render(<DueForProphylaxis />);

    expect(cells(/rhd00003/)).toEqual([
      'Abebe Zeleke',
      'rhd00003',
      'BPG · every 28 days',
      '31-Aug-2026',
      'Recorded today',
      '83%',
      'View chart',
    ]);
    expect(
      within(screen.getByRole('row', { name: /rhd00003/ })).getByRole('link', { name: 'View chart' }),
    ).toHaveAttribute('href', '/openmrs/spa/patient/patient-today/chart');
    expect(screen.getByText('2 waiting')).toBeInTheDocument();
  });

  it('asks for every listed patient whether they were recorded today, not only the first page', () => {
    dataset({ rows: manyDueRows(12) });
    recorded(['patient-11']);

    render(<DueForProphylaxis />);

    expect(mockUseRecordedToday).toHaveBeenLastCalledWith(manyDueRows(12).map((row) => row.patient_uuid));
    expect(screen.getByText('11 waiting')).toBeInTheDocument();
  });

  it('hides the waiting count once everyone due now was recorded today', async () => {
    dataset({ rows: dueRows });
    recorded(['patient-overdue', 'patient-oral', 'patient-today']);

    render(<DueForProphylaxis />);
    await showAll();

    expect(screen.getAllByText('Recorded today')).toHaveLength(3);
    expect(screen.queryByText(/waiting/)).not.toBeInTheDocument();
  });

  it('offers no Record button until it knows who was recorded today', () => {
    dataset({ rows: dueRows });
    mockUseRecordedToday.mockReturnValue({
      recorded: new Set(),
      isLoading: true,
      isValidating: true,
      error: undefined,
    });

    render(<DueForProphylaxis />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Record/ })).not.toBeInTheDocument();
  });

  it('holds Record while it checks again, as the answer it remembers may predate a dose just recorded', async () => {
    const actual = await vi.importActual<typeof import('./recorded-today.resource')>('./recorded-today.resource');
    mockUseRecordedToday.mockImplementation(actual.useRecordedToday);
    dataset({ rows: [dueRows[0]] });
    // One cache across both visits, as the app keeps one.
    const cache = new Map();
    const page = () => (
      <SWRConfig value={{ provider: () => cache, dedupingInterval: 0 }}>
        <DueForProphylaxis />
      </SWRConfig>
    );
    mockOpenmrsFetch.mockResolvedValue({ data: { results: [] } } as never);
    const { unmount } = render(page());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Record BPG' })).toBeEnabled());
    unmount();

    let answer: (response: unknown) => void;
    mockOpenmrsFetch.mockReturnValue(new Promise((resolve) => (answer = resolve)) as never);
    render(page());

    // SWR starts checking again a frame after the list mounts.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Record BPG' })).toBeDisabled());
    answer({ data: { results: [{ uuid: 'dose', form: { uuid: bpgForm } }] } });
    expect(await screen.findByText('Recorded today')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Record BPG' })).not.toBeInTheDocument();
  });

  it('warns, and counts no one as waiting, when it cannot tell who was recorded today', () => {
    dataset({ rows: dueRows });
    mockUseRecordedToday.mockReturnValue({
      recorded: new Set(),
      isLoading: false,
      isValidating: false,
      error: new Error('timeout'),
    });

    render(<DueForProphylaxis />);

    expect(screen.getByText('Could not check who was recorded today')).toBeInTheDocument();
    expect(screen.queryByText(/waiting/)).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Record/ })).toHaveLength(3);
  });

  it('shows the patients on BPG first, and the oral ones or all of them with their counts', async () => {
    dataset({ rows: dueRows });

    render(<DueForProphylaxis />);

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['BPG 3', 'Oral 1', 'All 4']);
    expect(screen.queryByRole('row', { name: /rhd00021/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /^Oral/ }));
    expect(
      screen
        .getAllByRole('row')
        .slice(1)
        .map((row) => within(row).getAllByRole('cell')[1].textContent),
    ).toEqual(['rhd00021']);
  });

  it('counts a patient due in the next two days as listed, not waiting', () => {
    dataset({ rows: dueRows });

    render(<DueForProphylaxis />);

    expect(cells(/rhd00052/)).toContain('Due in 48 h');
    expect(screen.getByText('3 waiting')).toBeInTheDocument();
  });

  it('downloads the patients the filter shows as CSV, for a user who may export lists', async () => {
    await signInWith(['App: act.dueList', 'Add Encounters', 'Task: act.lists.export']);
    dataset({ rows: dueRows });
    render(<DueForProphylaxis />);

    await userEvent.click(screen.getByRole('tab', { name: /^Oral/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Download CSV' }));

    expect(vi.mocked(downloadCsv)).toHaveBeenCalledWith(
      expect.stringMatching(/^due-for-prophylaxis-oral-/),
      ['Patient', 'ACT ID', 'Prescription', 'Last dose', 'Status', 'Adherence'],
      [['Joan Apio', 'rhd00021', 'Penicillin V', '', 'Due today', '70%']],
    );
  });

  it('offers no CSV to a user who may not export lists', () => {
    dataset({ rows: dueRows });

    render(<DueForProphylaxis />);

    expect(screen.queryByRole('button', { name: 'Download CSV' })).not.toBeInTheDocument();
  });

  it('shows an error when the report cannot be evaluated', () => {
    dataset({ error: new Error('forbidden') });

    render(<DueForProphylaxis />);

    expect(screen.getByText('Could not load the patients due for prophylaxis')).toBeInTheDocument();
  });

  it('says so when nobody is due', () => {
    dataset({ rows: [] });

    render(<DueForProphylaxis />);

    expect(screen.getByText('Nobody is due for prophylaxis')).toBeInTheDocument();
  });
});

describe('Due for prophylaxis widget', () => {
  beforeEach(async () => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    await signInWith(['App: act.dueList', 'Add Encounters']);
    recorded([]);
  });

  it('shows the first five patients and how many of all of them are waiting', () => {
    dataset({ rows: manyDueRows(7) });
    recorded(['patient-6']);

    render(<DueForProphylaxisWidget />);

    expect(screen.getByRole('heading', { name: 'Due for prophylaxis' })).toBeInTheDocument();
    expect(screen.getByText('6 waiting')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(1 + 5);
    expect(screen.getByRole('link', { name: /Open/ })).toHaveAttribute(
      'href',
      '/openmrs/spa/home/act-due-for-prophylaxis',
    );
  });

  it('keeps the waiting count beside Open, apart from the title', () => {
    dataset({ rows: manyDueRows(7) });

    render(<DueForProphylaxisWidget />);

    // The header's right-hand group has no role, so it is found as Open's parent.
    // eslint-disable-next-line testing-library/no-node-access
    const end = screen.getByRole('link', { name: /Open/ }).parentElement;
    expect(end).toContainElement(screen.getByText('7 waiting'));
    expect(end).not.toContainElement(screen.getByRole('heading', { name: 'Due for prophylaxis' }));
  });

  it('counts no one as waiting until it knows who was recorded today', () => {
    dataset({ rows: manyDueRows(7) });
    mockUseRecordedToday.mockReturnValue({
      recorded: new Set(),
      isLoading: true,
      isValidating: true,
      error: undefined,
    });

    render(<DueForProphylaxisWidget />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByText(/waiting/)).not.toBeInTheDocument();
  });

  it('holds Record while it checks again who was recorded today', () => {
    dataset({ rows: manyDueRows(2) });
    mockUseRecordedToday.mockReturnValue({
      recorded: new Set(),
      isLoading: false,
      isValidating: true,
      error: undefined,
    });

    render(<DueForProphylaxisWidget />);

    expect(
      screen.getAllByRole('button', { name: 'Record BPG' }).map((button) => button.hasAttribute('disabled')),
    ).toEqual([true, true]);
  });

  it('hides the waiting count once everyone listed was recorded today', () => {
    dataset({ rows: manyDueRows(2) });
    recorded(['patient-0', 'patient-1']);

    render(<DueForProphylaxisWidget />);

    expect(screen.getAllByText('Recorded today')).toHaveLength(2);
    expect(screen.queryByText(/waiting/)).not.toBeInTheDocument();
  });
});
