import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import { openmrsFetch, useSession } from '@openmrs/esm-framework';
import { atSessionLocation, signInWith } from '../access/sign-in.test-helper';
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
vi.mock('./due-for-prophylaxis.scss', () => ({
  default: { dueTag: 'dueTag', lowAdherence: 'lowAdherence', goodAdherence: 'goodAdherence' },
}));
const mockUseReportDataset = vi.mocked(useReportDataset);
const mockOpenFormInChart = vi.mocked(openFormInChart);
const mockUseRecordedToday = vi.mocked(useRecordedToday);

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
  mockUseRecordedToday.mockReturnValue({ recorded: new Set(patientUuids) });
}

/** Shows every patient, not only those on BPG, the list's first choice. */
async function showAll() {
  await userEvent.click(await screen.findByRole('tab', { name: /^All/ }));
}

function cells(name: RegExp) {
  return within(screen.getByRole('row', { name }))
    .getAllByRole('cell')
    .map((cell) => cell.textContent);
}

/** The status tag in the patient's row: its text, its Carbon colour and whether it is drawn yellow. */
function statusTag(name: RegExp) {
  const status = within(screen.getByRole('row', { name })).getAllByRole('cell')[4];
  // The tag has no role, so it is found around its label.
  // eslint-disable-next-line testing-library/no-node-access
  const tag = within(status).getByTitle(/./).parentElement;
  return [
    tag.textContent,
    tag.className.match(/cds--tag--(red|green|warm-gray)/)?.[0],
    tag.classList.contains('dueTag'),
  ];
}

// A cache per render, so no test reads the session location another one looked up; it renders once that is answered.
async function renderPage() {
  const view = render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <DueForProphylaxis />
    </SWRConfig>,
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return view;
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
    // A location of no clinic kind, so every patient on the report is listed.
    atSessionLocation('Kiswa HC III', [], 'clinic');
    mockOpenFormInChart.mockReset();
    recorded([]);
  });

  it('lists only the patients whose primary care clinic it is, at a primary care clinic', async () => {
    atSessionLocation('Kiswa HC III', ['RHD Community']);
    dataset({
      rows: dueRows.map((row, i) => ({ ...row, primary_care_clinic: i % 2 ? 'Acimi HCIII' : 'Kiswa HC III' })),
    });

    await renderPage();
    await showAll();

    const listed = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(listed).toHaveLength(dueRows.filter((_, i) => i % 2 === 0).length);
  });

  it("says so, rather than listing nobody, when a cardiac clinic's patients cannot be told from the registry", async () => {
    atSessionLocation('Gulu RRH', ['RHD District']);
    mockUseReportDataset.mockImplementation((report) => ({
      columns: [],
      rows: report === 'f3d8b672-a8a3-47a3-8a0b-dff01de6e3a8' ? dueRows : [],
      isLoading: false,
      error:
        report === 'f3d8b672-a8a3-47a3-8a0b-dff01de6e3a8' ? undefined : new Error('Privilege required: Run Reports'),
      mutate: vi.fn(),
    }));

    await renderPage();

    expect(await screen.findByText(/could not/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('waits for the registry, rather than listing nobody, at a cardiac clinic, whose patients it tells', async () => {
    atSessionLocation('Lira RRH', ['RHD District']);
    mockUseReportDataset.mockImplementation((report) => ({
      columns: [],
      rows: report === 'f3d8b672-a8a3-47a3-8a0b-dff01de6e3a8' ? dueRows : [],
      isLoading: report !== 'f3d8b672-a8a3-47a3-8a0b-dff01de6e3a8',
      error: undefined,
      mutate: vi.fn(),
    }));

    await renderPage();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it("says it could not load, rather than listing every clinic's patients, when the session location's kind cannot be read", async () => {
    atSessionLocation('Kiswa HC III', ['RHD Community'], 'unreadable');
    vi.mocked(openmrsFetch).mockRejectedValue(new Error('Internal Server Error'));
    dataset({ rows: dueRows });

    await renderPage();

    expect(await screen.findByText('Could not load the patients due for prophylaxis')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it("asks who was recorded today for no one, rather than every clinic's patients, while the session location is looked up", async () => {
    atSessionLocation('Kiswa HC III', ['RHD Community'], 'looking-up');
    vi.mocked(openmrsFetch).mockReturnValue(new Promise(() => {}) as never);
    dataset({ rows: dueRows });

    await renderPage();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(mockUseRecordedToday.mock.calls.every(([uuids]) => uuids.length === 0)).toBe(true);
  });

  it("lists each patient's prescription, last dose, status and adherence", async () => {
    dataset({ rows: dueRows });

    await renderPage();
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

  it('tags Overdue red, Due today and Due in 48 h yellow, and Recorded today green', async () => {
    dataset({ rows: dueRows });
    recorded(['patient-today']);

    await renderPage();
    await showAll();

    expect([/rhd00012/, /rhd00021/, /rhd00003/, /rhd00052/].map(statusTag)).toEqual([
      ['Overdue', 'cds--tag--red', false],
      ['Due today', 'cds--tag--warm-gray', true],
      ['Recorded today', 'cds--tag--green', false],
      ['Due in 48 h', 'cds--tag--warm-gray', true],
    ]);
  });

  it('shows adherence red below 80% and green from 80%', async () => {
    dataset({
      rows: [
        { ...dueRows[0], adherence: 79 },
        { ...dueRows[2], adherence: 80 },
      ],
    });

    await renderPage();

    expect(screen.getByText('79%')).toHaveClass('lowAdherence');
    expect(screen.getByText('80%')).toHaveClass('goodAdherence');
  });

  it('opens the BPG form in the chart from Record BPG, and the oral form from Record oral', async () => {
    dataset({ rows: dueRows });
    await renderPage();
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
    await renderPage();
    await showAll();

    const recordBpg = within(screen.getByRole('row', { name: /rhd00012/ })).getByRole('button');
    await userEvent.click(recordBpg);

    expect(recordBpg).toBeDisabled();
    expect(within(screen.getByRole('row', { name: /rhd00021/ })).getByRole('button')).toBeDisabled();
    expect(mockOpenFormInChart).toHaveBeenCalledTimes(1);
  });

  it('shows a patient recorded today as Recorded today, with View chart in place of Record', async () => {
    dataset({ rows: dueRows });
    recorded(['patient-today']);

    await renderPage();

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

  it('reads who was recorded today from every listed row, not only the first page', async () => {
    dataset({ rows: manyDueRows(12) });
    recorded(['patient-11']);

    await renderPage();

    expect(mockUseRecordedToday).toHaveBeenLastCalledWith(manyDueRows(12));
    expect(screen.getByText('11 waiting')).toBeInTheDocument();
  });

  it('hides the waiting count once everyone due now was recorded today', async () => {
    dataset({ rows: dueRows });
    recorded(['patient-overdue', 'patient-oral', 'patient-today']);

    await renderPage();
    await showAll();

    expect(screen.getAllByText('Recorded today')).toHaveLength(3);
    expect(screen.queryByText(/waiting/)).not.toBeInTheDocument();
  });

  it('shows the patients on BPG first, and the oral ones or all of them with their counts', async () => {
    dataset({ rows: dueRows });

    await renderPage();

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

  it('counts a patient due in the next two days as listed, not waiting', async () => {
    dataset({ rows: dueRows });

    await renderPage();

    expect(cells(/rhd00052/)).toContain('Due in 48 h');
    expect(screen.getByText('3 waiting')).toBeInTheDocument();
  });

  it('downloads the patients the filter shows as CSV, for a user who may export lists', async () => {
    await signInWith(['App: act.dueList', 'Add Encounters', 'Task: act.lists.export']);
    dataset({ rows: dueRows });
    await renderPage();

    await userEvent.click(screen.getByRole('tab', { name: /^Oral/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Download CSV' }));

    expect(vi.mocked(downloadCsv)).toHaveBeenCalledWith(
      expect.stringMatching(/^due-for-prophylaxis-oral-/),
      ['Patient', 'ACT ID', 'Prescription', 'Last dose', 'Status', 'Adherence'],
      [['Joan Apio', 'rhd00021', 'Penicillin V', '', 'Due today', '70%']],
    );
  });

  it('offers no CSV to a user who may not export lists', async () => {
    dataset({ rows: dueRows });

    await renderPage();

    expect(screen.queryByRole('button', { name: 'Download CSV' })).not.toBeInTheDocument();
  });

  it('shows an error when the report cannot be evaluated', async () => {
    dataset({ error: new Error('forbidden') });

    await renderPage();

    expect(screen.getByText('Could not load the patients due for prophylaxis')).toBeInTheDocument();
  });

  it('says so when nobody is due', async () => {
    dataset({ rows: [] });

    await renderPage();

    expect(screen.getByText('Nobody is due for prophylaxis')).toBeInTheDocument();
  });
});

describe('Due for prophylaxis widget', () => {
  beforeEach(async () => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    await signInWith(['App: act.dueList', 'Add Encounters']);
    recorded([]);
  });

  it('shows the first five patients and how many of all of them are waiting', async () => {
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

  it('keeps the waiting count beside Open, apart from the title', async () => {
    dataset({ rows: manyDueRows(7) });

    render(<DueForProphylaxisWidget />);

    // The header's right-hand group has no role, so it is found as Open's parent.
    // eslint-disable-next-line testing-library/no-node-access
    const end = screen.getByRole('link', { name: /Open/ }).parentElement;
    expect(end).toContainElement(screen.getByText('7 waiting'));
    expect(end).not.toContainElement(screen.getByRole('heading', { name: 'Due for prophylaxis' }));
  });

  it('downloads the patients the filter shows as CSV', async () => {
    await signInWith(['App: act.dueList', 'Add Encounters', 'Task: act.lists.export']);
    dataset({ rows: dueRows });
    render(<DueForProphylaxisWidget />);
    const csvNames = () => vi.mocked(downloadCsv).mock.lastCall[2].map((row) => row[0]);

    await userEvent.click(screen.getByRole('button', { name: 'Download CSV' }));
    expect(csvNames()).toEqual(['Amina Nakato', 'Abebe Zeleke', 'Peter Mugisha']);

    await userEvent.click(screen.getByRole('tab', { name: /^Oral/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Download CSV' }));
    expect(csvNames()).toEqual(['Joan Apio']);
  });

  it('hides the waiting count once everyone listed was recorded today', async () => {
    dataset({ rows: manyDueRows(2) });
    recorded(['patient-0', 'patient-1']);

    render(<DueForProphylaxisWidget />);

    expect(screen.getAllByText('Recorded today')).toHaveLength(2);
    expect(screen.queryByText(/waiting/)).not.toBeInTheDocument();
  });
});
