import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSession } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { useReportDataset } from '../reports/report-dataset.resource';
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
  mockUseRecordedToday.mockReturnValue({ recorded: new Set(patientUuids), isLoading: false });
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

  it("lists each patient's name, ACT ID, type, last dose and status", () => {
    dataset({ rows: dueRows });

    render(<DueForProphylaxis />);

    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Name',
      'ACT ID',
      'Type',
      'Last dose',
      'Status',
      '',
    ]);
    expect(cells(/rhd00012/)).toEqual(['Amina Nakato', 'rhd00012', 'BPG', '24-Aug-2026', 'Overdue', 'Record BPG']);
    expect(cells(/rhd00021/)).toEqual(['Joan Apio', 'rhd00021', 'Oral', '', 'Due today', 'Record oral']);
    expect(screen.getByRole('link', { name: 'Amina Nakato' })).toHaveAttribute(
      'href',
      '/openmrs/spa/patient/patient-overdue/chart',
    );
  });

  it('opens the BPG form in the chart from Record BPG, and the oral form from Record oral', async () => {
    dataset({ rows: dueRows });
    render(<DueForProphylaxis />);

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
      'BPG',
      '31-Aug-2026',
      'Recorded today',
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
});
