import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import {
  closeWorkspaceGroup2,
  fetchCurrentPatient,
  launchWorkspace2,
  navigate,
  openmrsFetch,
  showSnackbar,
  useSession,
} from '@openmrs/esm-framework';
import { atSessionLocation, signInWith } from '../access/sign-in.test-helper';
import { useReportDataset } from '../reports/report-dataset.resource';
import { downloadCsv } from '../table-filters/csv';
import { fetchForm } from '../flag-gaps/flag-gaps.resource';
import { openFormInChart } from '../visits/open-form-in-chart';
import { findActiveVisit, startVisit } from '../visits/start-visit';
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
vi.mock('../visits/start-visit', () => ({ findActiveVisit: vi.fn(), startVisit: vi.fn() }));
vi.mock('../flag-gaps/flag-gaps.resource', () => ({ fetchForm: vi.fn() }));
vi.mock('@openmrs/esm-framework', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchCurrentPatient: vi.fn(),
}));
vi.mock('./recorded-today.resource', () => ({ useRecordedToday: vi.fn() }));
vi.mock('../table-filters/csv', () => ({ downloadCsv: vi.fn() }));
vi.mock('./due-for-prophylaxis.scss', () => ({
  default: { dueTag: 'dueTag', lowAdherence: 'lowAdherence', goodAdherence: 'goodAdherence', recordDose: 'recordDose' },
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
  const status = within(screen.getByRole('row', { name })).getAllByRole('cell')[3];
  // The tag has no role, so it is found around its label.
  // eslint-disable-next-line testing-library/no-node-access
  const tag = within(status).getByTitle(/./).parentElement;
  return [
    tag.textContent,
    tag.className.match(/cds--tag--(red|green|warm-gray|blue)/)?.[0],
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
    vi.mocked(launchWorkspace2).mockReset();
    vi.mocked(launchWorkspace2).mockResolvedValue(true);
    vi.mocked(closeWorkspaceGroup2).mockResolvedValue(true);
    vi.mocked(fetchForm).mockImplementation((uuid: string) => Promise.resolve({ uuid, display: uuid }) as never);
    vi.mocked(fetchCurrentPatient).mockImplementation((uuid: string) => Promise.resolve({ id: uuid }) as never);
    vi.mocked(findActiveVisit).mockResolvedValue({ uuid: 'active-visit' } as never);
    vi.mocked(startVisit).mockResolvedValue({ uuid: 'started-visit' } as never);
    recorded([]);
  });

  it('heads the page with the appointments pictogram', () => {
    dataset({ rows: dueRows });
    render(<DueForProphylaxis />);

    expect(within(screen.getByTestId('act-page-header')).getByText('AppointmentsPictogram')).toBeInTheDocument();
  });

  it('draws Record BPG and Record oral at one minimum width, so the column lines up', async () => {
    dataset({ rows: dueRows });
    render(<DueForProphylaxis />);
    await userEvent.click(await screen.findByRole('tab', { name: /^All/ }));

    const buttons = await screen.findAllByRole('button', { name: /^Record (BPG|oral)$/ });
    expect(buttons.map((button) => button.textContent)).toEqual(expect.arrayContaining(['Record BPG', 'Record oral']));
    buttons.forEach((button) => expect(button).toHaveClass('recordDose'));
    const sheet = readFileSync(resolve(process.cwd(), 'src/due-for-prophylaxis/due-for-prophylaxis.scss'), 'utf8');
    expect(sheet).toMatch(/\.recordDose\s*\{[^}]*min-width: 10rem;/);
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
      'Prescription',
      'Last dose',
      'Status',
      'Adherence',
      '',
    ]);
    expect(cells(/rhd00012/)).toEqual([
      'Amina Nakatorhd00012',
      'BPG · every 28 days',
      '24-Aug-2026',
      'Overdue',
      '64%',
      'Record BPG',
    ]);
    // Joan has no oral report yet, so her first supply is what is due.
    expect(cells(/rhd00021/)).toEqual([
      'Joan Apiorhd00021',
      'Penicillin V',
      '',
      'First dose due',
      '70%',
      'Record oral',
    ]);
    expect(cells(/rhd00052/)).toEqual([
      'Peter Mugisharhd00052',
      'BPG · every 28 days',
      '26-Aug-2026',
      'Due soon',
      '',
      'Record BPG',
    ]);
    expect(screen.getByRole('link', { name: 'Amina Nakato' })).toHaveAttribute(
      'href',
      '/openmrs/spa/patient/patient-overdue/chart',
    );
  });

  it('tags Overdue red, First dose due blue as in the patient banner, Due soon yellow, and Recorded today green', async () => {
    dataset({ rows: dueRows });
    recorded(['patient-today']);

    await renderPage();
    await showAll();

    expect([/rhd00012/, /rhd00021/, /rhd00003/, /rhd00052/].map(statusTag)).toEqual([
      ['Overdue', 'cds--tag--red', false],
      ['First dose due', 'cds--tag--blue', false],
      ['Recorded today', 'cds--tag--green', false],
      ['Due soon', 'cds--tag--warm-gray', true],
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

  it("opens the BPG form beside the list from Record BPG, and the oral form from Record oral, in the patient's visit", async () => {
    dataset({ rows: dueRows });
    await renderPage();
    await showAll();

    await userEvent.click(within(screen.getByRole('row', { name: /rhd00012/ })).getByRole('button'));
    await waitFor(() => expect(launchWorkspace2).toHaveBeenCalledTimes(1));
    await userEvent.click(within(screen.getByRole('row', { name: /rhd00021/ })).getByRole('button'));
    await waitFor(() => expect(launchWorkspace2).toHaveBeenCalledTimes(2));

    expect(vi.mocked(launchWorkspace2).mock.calls).toEqual([
      [
        'act-record-dose-form-entry-workspace',
        { form: { uuid: bpgForm, display: bpgForm }, encounterUuid: '', handlePostResponse: expect.any(Function) },
        { patient: { id: 'patient-overdue' }, patientUuid: 'patient-overdue', visitContext: { uuid: 'active-visit' } },
      ],
      [
        'act-record-dose-form-entry-workspace',
        { form: { uuid: oralForm, display: oralForm }, encounterUuid: '', handlePostResponse: expect.any(Function) },
        { patient: { id: 'patient-oral' }, patientUuid: 'patient-oral', visitContext: { uuid: 'active-visit' } },
      ],
    ]);
    expect(navigate).not.toHaveBeenCalled();
    expect(mockOpenFormInChart).not.toHaveBeenCalled();
    expect(startVisit).not.toHaveBeenCalled();
  });

  it('starts a visit for a patient who has none, and opens the form in it', async () => {
    vi.mocked(findActiveVisit).mockResolvedValue(null);
    dataset({ rows: dueRows });
    await renderPage();

    await userEvent.click(within(screen.getByRole('row', { name: /rhd00012/ })).getByRole('button'));

    await waitFor(() => expect(launchWorkspace2).toHaveBeenCalled());
    expect(startVisit).toHaveBeenCalledWith(expect.anything(), 'patient-overdue', expect.any(String), 'clinic');
    expect(vi.mocked(launchWorkspace2).mock.calls[0][2]).toEqual(
      expect.objectContaining({ visitContext: { uuid: 'started-visit' } }),
    );
  });

  it('opens one form at a time, so a second click cannot start a second visit', async () => {
    vi.mocked(findActiveVisit).mockReturnValue(new Promise(() => {}));
    dataset({ rows: dueRows });
    await renderPage();
    await showAll();

    const recordBpg = within(screen.getByRole('row', { name: /rhd00012/ })).getByRole('button');
    await userEvent.click(recordBpg);

    expect(recordBpg).toBeDisabled();
    expect(within(screen.getByRole('row', { name: /rhd00021/ })).getByRole('button')).toBeDisabled();
    expect(findActiveVisit).toHaveBeenCalledTimes(1);
    expect(launchWorkspace2).not.toHaveBeenCalled();
  });

  it('opens the same form again for a second click on a row, so the open form is not replaced', async () => {
    // A fresh object per lookup, as the server sends; mockResolvedValue makes the toBe checks trivial.
    vi.mocked(findActiveVisit).mockImplementation(() => Promise.resolve({ uuid: 'active-visit' }) as never);
    dataset({ rows: dueRows });
    await renderPage();

    const recordBpg = within(screen.getByRole('row', { name: /rhd00012/ })).getByRole('button');
    await userEvent.click(recordBpg);
    await waitFor(() => expect(launchWorkspace2).toHaveBeenCalledTimes(1));
    await userEvent.click(recordBpg);
    await waitFor(() => expect(launchWorkspace2).toHaveBeenCalledTimes(2));

    const [first, second] = vi.mocked(launchWorkspace2).mock.calls as Array<
      [string, Record<string, unknown>, Record<string, unknown>]
    >;
    expect(second[1].form).toBe(first[1].form);
    expect(second[1].handlePostResponse).toBe(first[1].handlePostResponse);
    expect(second[2].patient).toBe(first[2].patient);
    expect(second[2].visitContext).toBe(first[2].visitContext);
  });

  it('opens the same form again after a filter with nobody in it hid the table, as the panel stays open', async () => {
    vi.mocked(findActiveVisit).mockImplementation(() => Promise.resolve({ uuid: 'active-visit' }) as never);
    dataset({ rows: dueRows.filter((row) => row.patient_uuid !== 'patient-oral') });
    await renderPage();

    const recordBpg = () => within(screen.getByRole('row', { name: /rhd00012/ })).getByRole('button');
    await userEvent.click(recordBpg());
    await waitFor(() => expect(launchWorkspace2).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole('tab', { name: /^Oral/ }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /^BPG/ }));
    await userEvent.click(recordBpg());
    await waitFor(() => expect(launchWorkspace2).toHaveBeenCalledTimes(2));

    const [first, second] = vi.mocked(launchWorkspace2).mock.calls as Array<
      [string, Record<string, unknown>, Record<string, unknown>]
    >;
    expect(second[1].form).toBe(first[1].form);
    expect(second[2].patient).toBe(first[2].patient);
    expect(second[2].visitContext).toBe(first[2].visitContext);
  });

  it('starts a visit on a second click once the one the form opened in has ended', async () => {
    vi.mocked(findActiveVisit).mockResolvedValueOnce({ uuid: 'first-visit' } as never);
    vi.mocked(findActiveVisit).mockResolvedValueOnce(null);
    dataset({ rows: dueRows });
    await renderPage();

    const recordBpg = within(screen.getByRole('row', { name: /rhd00012/ })).getByRole('button');
    await userEvent.click(recordBpg);
    await waitFor(() => expect(launchWorkspace2).toHaveBeenCalledTimes(1));
    await userEvent.click(recordBpg);
    await waitFor(() => expect(launchWorkspace2).toHaveBeenCalledTimes(2));

    const visits = vi
      .mocked(launchWorkspace2)
      .mock.calls.map((call) => (call[2] as { visitContext: unknown }).visitContext);
    expect(visits).toEqual([{ uuid: 'first-visit' }, { uuid: 'started-visit' }]);
    expect(startVisit).toHaveBeenCalledTimes(1);
  });

  it("opens the form in the patient's new visit on a second click, once the one it opened in has ended", async () => {
    vi.mocked(findActiveVisit).mockResolvedValueOnce({ uuid: 'first-visit' } as never);
    vi.mocked(findActiveVisit).mockResolvedValueOnce({ uuid: 'second-visit' } as never);
    dataset({ rows: dueRows });
    await renderPage();

    const recordBpg = within(screen.getByRole('row', { name: /rhd00012/ })).getByRole('button');
    await userEvent.click(recordBpg);
    await waitFor(() => expect(launchWorkspace2).toHaveBeenCalledTimes(1));
    await userEvent.click(recordBpg);
    await waitFor(() => expect(launchWorkspace2).toHaveBeenCalledTimes(2));

    expect(vi.mocked(launchWorkspace2).mock.calls[1][2]).toEqual(
      expect.objectContaining({ visitContext: { uuid: 'second-visit' } }),
    );
    expect(startVisit).not.toHaveBeenCalled();
  });

  it("asks about another form's unsaved changes before starting a visit, and starts none if they are kept", async () => {
    vi.mocked(findActiveVisit).mockResolvedValue(null);
    vi.mocked(closeWorkspaceGroup2).mockResolvedValue(false);
    dataset({ rows: dueRows });
    await renderPage();

    await userEvent.click(within(screen.getByRole('row', { name: /rhd00012/ })).getByRole('button'));

    await waitFor(() => expect(closeWorkspaceGroup2).toHaveBeenCalled());
    expect(startVisit).not.toHaveBeenCalled();
    expect(launchWorkspace2).not.toHaveBeenCalled();
  });

  it('leaves other forms to the workspace to ask about when the patient already has a visit', async () => {
    dataset({ rows: dueRows });
    await renderPage();

    await userEvent.click(within(screen.getByRole('row', { name: /rhd00012/ })).getByRole('button'));

    await waitFor(() => expect(launchWorkspace2).toHaveBeenCalled());
    expect(closeWorkspaceGroup2).not.toHaveBeenCalled();
  });

  it('says so when the form cannot be loaded, and loads it again on the next click', async () => {
    vi.mocked(fetchForm).mockRejectedValueOnce(new Error('The server did not answer'));
    dataset({ rows: dueRows });
    await renderPage();

    const recordBpg = within(screen.getByRole('row', { name: /rhd00012/ })).getByRole('button');
    await userEvent.click(recordBpg);
    await waitFor(() =>
      expect(showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'error',
          title: 'Could not open the form',
          subtitle: 'The server did not answer',
        }),
      ),
    );
    expect(launchWorkspace2).not.toHaveBeenCalled();

    await userEvent.click(recordBpg);
    await waitFor(() => expect(launchWorkspace2).toHaveBeenCalled());
  });

  it('says so when the form cannot be opened beside the list', async () => {
    vi.mocked(launchWorkspace2).mockRejectedValue(new Error('No workspace is registered'));
    dataset({ rows: dueRows });
    await renderPage();

    await userEvent.click(within(screen.getByRole('row', { name: /rhd00012/ })).getByRole('button'));

    await waitFor(() =>
      expect(showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Could not open the form', subtitle: 'No workspace is registered' }),
      ),
    );
  });

  it('shows a patient recorded today as Recorded today, with View chart in place of Record', async () => {
    dataset({ rows: dueRows });
    recorded(['patient-today']);

    await renderPage();

    expect(cells(/rhd00003/)).toEqual([
      'Abebe Zelekerhd00003',
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
        .map((row) => within(row).getAllByRole('cell')[0].textContent),
    ).toEqual(['Joan Apiorhd00021']);
  });

  it('counts a patient due in the next two days as listed, not waiting', async () => {
    dataset({ rows: dueRows });

    await renderPage();

    expect(cells(/rhd00052/)).toContain('Due soon');
    expect(screen.getByText('3 waiting')).toBeInTheDocument();
  });

  it('downloads the patients the filter shows as CSV, for a user who may export lists', async () => {
    await signInWith(['App: act.dueList', 'Add Encounters', 'Task: act.lists.export']);
    dataset({ rows: dueRows });
    await renderPage();

    await userEvent.click(screen.getByRole('tab', { name: /^Oral/ }));
    // The download is recorded through ACT Core before the file is made.
    vi.mocked(openmrsFetch).mockResolvedValue({ data: {} } as never);
    await userEvent.click(screen.getByRole('button', { name: 'Download CSV' }));

    await waitFor(() => expect(vi.mocked(downloadCsv)).toHaveBeenCalled());
    expect(vi.mocked(downloadCsv)).toHaveBeenCalledWith(
      expect.stringMatching(/^due-for-prophylaxis-oral-/),
      ['Patient', 'ACT ID', 'Prescription', 'Last dose', 'Status', 'Adherence'],
      [['Joan Apio', 'rhd00021', 'Penicillin V', '', 'First dose due', '70%']],
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
    // The download is recorded through ACT Core before the file is made.
    vi.mocked(openmrsFetch).mockResolvedValue({ data: {} } as never);

    await userEvent.click(screen.getByRole('button', { name: 'Download CSV' }));
    await waitFor(() => expect(vi.mocked(downloadCsv)).toHaveBeenCalledTimes(1));
    expect(csvNames()).toEqual(['Amina Nakato', 'Abebe Zeleke', 'Peter Mugisha']);

    await userEvent.click(screen.getByRole('tab', { name: /^Oral/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Download CSV' }));
    await waitFor(() => expect(vi.mocked(downloadCsv)).toHaveBeenCalledTimes(2));
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
