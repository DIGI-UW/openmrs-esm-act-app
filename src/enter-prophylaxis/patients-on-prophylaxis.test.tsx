import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { signInWith } from '../access/sign-in.test-helper';
import { useRecordedToday } from '../due-for-prophylaxis/recorded-today.resource';
import { useReportDataset } from '../reports/report-dataset.resource';
import EnterProphylaxis from './patients-on-prophylaxis.component';
import { asProphylaxisRow } from './patients-on-prophylaxis';

// Who may record a form is may-enter-form's own test; here every form may be recorded.
vi.mock('../access/may-enter-form', () => ({
  MayEnterForm: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('../reports/report-dataset.resource', () => ({ useReportDataset: vi.fn() }));
vi.mock('../due-for-prophylaxis/recorded-today.resource', () => ({ useRecordedToday: vi.fn() }));

const registryRow = (i: number, value: Record<string, unknown>) => ({
  patient_uuid: `patient-${i}`,
  full_name: `Patient ${i}`,
  rhd_id: `rhd0000${i}`,
  ...value,
});

const rows = [
  registryRow(1, {
    prophylaxis_type: 'BPG',
    bpg_status: 'Not covered',
    prophylaxis_regimen: 'Q28 day BPG',
    injection_interval_days: 28,
    adherence: 62,
  }),
  registryRow(2, { prophylaxis_type: 'BPG', bpg_status: 'Covered', prophylaxis_regimen: 'Q21 day BPG', adherence: 96 }),
  registryRow(3, { bpg_status: 'No prescription' }),
  registryRow(4, { prophylaxis_type: 'Oral', prophylaxis_regimen: 'Oral penicillin', adherence: 88 }),
  registryRow(5, {}),
];

const tableRows = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    );

describe('asProphylaxisRow', () => {
  it('reads a registry row as the due list does, leaving out a patient not yet typed', () => {
    expect(rows.map(asProphylaxisRow).map((row) => row && [row.prophylaxis_type, row.status])).toEqual([
      ['BPG', 'overdue'],
      ['BPG', 'up_to_date'],
      ['', 'no_prescription'],
      ['Oral', ''],
      null,
    ]);
  });
});

describe('Enter prophylaxis', () => {
  beforeEach(async () => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    await signInWith(['App: act.registry', 'Add Encounters']);
    vi.mocked(useReportDataset).mockReturnValue({
      columns: [],
      rows,
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });
    vi.mocked(useRecordedToday).mockReturnValue({
      recorded: new Set(),
      isLoading: false,
      isValidating: false,
      error: undefined,
    });
  });

  it('lists every patient on prophylaxis, and those without a prescription, with what to record for each', () => {
    render(<EnterProphylaxis />);

    expect(screen.getByRole('tab', { name: /^All/ })).toHaveAttribute('aria-selected', 'true');
    expect(tableRows()).toEqual([
      ['Patient 1', 'rhd00001', 'BPG · every 28 days', '', 'Overdue', '62%', 'Record BPG'],
      ['Patient 2', 'rhd00002', 'Q21 day BPG', '', 'Up to date', '96%', 'Record BPG'],
      ['Patient 3', 'rhd00003', 'None', '', 'No prescription', '', 'Needs prescription'],
      ['Patient 4', 'rhd00004', 'Oral penicillin', '', '', '88%', 'Record oral'],
    ]);
  });

  it('narrows the list by BPG or oral and by name or ACT ID', async () => {
    render(<EnterProphylaxis />);

    await userEvent.click(screen.getByRole('tab', { name: /^Oral/ }));
    expect(tableRows().map((row) => row[0])).toEqual(['Patient 4']);

    await userEvent.click(screen.getByRole('tab', { name: /^All/ }));
    await userEvent.type(screen.getByRole('searchbox'), 'rhd00002');
    expect(tableRows().map((row) => row[0])).toEqual(['Patient 2']);
  });
});
