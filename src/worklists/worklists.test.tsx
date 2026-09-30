import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { navigate } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { useReportDataset } from '../reports/report-dataset.resource';
import { type RhdFlagList, useRhdFlagLists } from '../rhd-flags/rhd-flag-lists.resource';
import Worklists from './worklists.component';

vi.mock('../reports/report-dataset.resource', () => ({ useReportDataset: vi.fn() }));
vi.mock('../rhd-flags/rhd-flag-lists.resource', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRhdFlagLists: vi.fn(),
}));
const mockUseReportDataset = vi.mocked(useReportDataset);
const mockUseRhdFlagLists = vi.mocked(useRhdFlagLists);

const worklistsPrivilege = 'View Patient Flags';

const list = (flagName: string, memberCount: number, priority: RhdFlagList['priority']): RhdFlagList => ({
  flagName,
  memberCount,
  priority,
  cohortUuid: flagName,
});

const lists = [
  list('RHD INR target missing', 2, 'dataQuality'),
  list('RHD prophylaxis overdue', 1, 'risk'),
  list('RHD lost to follow-up', 0, 'risk'),
];

const row = (i: number, flags: string) => ({
  rhd_id: `rhd0000${i}`,
  full_name: `Patient ${i}`,
  sex: i % 2 ? 'M' : 'F',
  age_years: 10 + i,
  diagnosis_category: 'RHD B',
  prophylaxis_regimen: 'Q28 day BPG',
  patient_uuid: `patient-${i}`,
  rhd_flags: flags,
});

const rows = [row(1, 'RHD INR target missing|RHD prophylaxis overdue'), row(2, 'RHD INR target missing'), row(3, '')];

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

function flagLists(value: Partial<ReturnType<typeof useRhdFlagLists>>) {
  mockUseRhdFlagLists.mockReturnValue({ lists: [], isLoading: false, error: undefined, ...value });
}

const tile = (flagName: string) => screen.getByRole('button', { name: new RegExp(flagName) });
const shownNames = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map((r) => within(r).getAllByRole('cell')[0].textContent);

describe('Worklists', () => {
  beforeEach(async () => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    window.history.replaceState(null, '', '/openmrs/spa/home/act-worklists');
    await signInWith([worklistsPrivilege]);
    flagLists({ lists });
    dataset({ rows });
  });

  it('shows a tile per list, risk lists first, with the list in the URL chosen', () => {
    window.history.replaceState(null, '', '/openmrs/spa/home/act-worklists?flag=RHD+INR+target+missing');

    render(<Worklists />);

    expect(screen.getAllByTestId('worklist-tile').map((t) => t.textContent)).toEqual([
      '1RHD prophylaxis overdue',
      '0RHD lost to follow-up',
      '2RHD INR target missing',
    ]);
    expect(tile('RHD INR target missing')).toHaveAttribute('aria-pressed', 'true');
    expect(tile('RHD prophylaxis overdue')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('heading', { name: 'RHD INR target missing' })).toBeInTheDocument();
    expect(shownNames()).toEqual(['Patient 1rhd00001', 'Patient 2rhd00002']);
  });

  it("lists the chosen list's patients with their ACT ID, age and sex, diagnosis and prophylaxis", () => {
    window.history.replaceState(null, '', '/openmrs/spa/home/act-worklists?flag=RHD+INR+target+missing');

    render(<Worklists />);

    const table = screen.getByRole('table');
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Patient', 'Age, sex', 'Diagnosis', 'Prophylaxis', '']);
    const [first] = within(table).getAllByRole('row').slice(1);
    expect(
      within(first)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['Patient 1rhd00001', '11 M', 'RHD B', 'Q28 day BPG', 'Open chart']);
  });

  it('opens the patient chart from a row', async () => {
    window.history.replaceState(null, '', '/openmrs/spa/home/act-worklists?flag=RHD+INR+target+missing');

    render(<Worklists />);

    const [first] = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    await userEvent.click(within(first).getByRole('button', { name: 'Open chart' }));

    expect(navigate).toHaveBeenCalledWith({ to: '${openmrsSpaBase}/patient/patient-1/chart' });
  });

  it('chooses the first list when the URL names none', () => {
    render(<Worklists />);

    expect(tile('RHD prophylaxis overdue')).toHaveAttribute('aria-pressed', 'true');
    expect(shownNames()).toEqual(['Patient 1rhd00001']);
  });

  it('changes the list, and the URL, when another tile is chosen', async () => {
    render(<Worklists />);

    await userEvent.click(tile('RHD INR target missing'));

    expect(tile('RHD INR target missing')).toHaveAttribute('aria-pressed', 'true');
    expect(tile('RHD prophylaxis overdue')).toHaveAttribute('aria-pressed', 'false');
    expect(shownNames()).toEqual(['Patient 1rhd00001', 'Patient 2rhd00002']);
    await waitFor(() => expect(window.location.search).toBe('?flag=RHD+INR+target+missing'));
  });

  it('says so when the chosen list has no patients', async () => {
    render(<Worklists />);

    await userEvent.click(tile('RHD lost to follow-up'));

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByText('No patients are on this list.')).toBeInTheDocument();
  });

  it('evaluates the registry report over every enrolment up to today', () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 29, 10) });

    render(<Worklists />);

    vi.useRealTimers();
    expect(mockUseReportDataset).toHaveBeenLastCalledWith('f1a2b3c4-d5e6-7890-abcd-ef1234567890', {
      startDate: '1900-01-01',
      endDate: '2026-09-29',
    });
  });

  it('shows a table skeleton while the patients load', () => {
    dataset({ isLoading: true });

    render(<Worklists />);

    expect(within(screen.getByTestId('worklist-patients-loading')).getByRole('table')).toBeInTheDocument();
  });

  it('says so when the patients cannot be loaded', () => {
    dataset({ error: new Error('Server responded with 500') });

    render(<Worklists />);

    expect(screen.getByText('Could not load the worklist patients')).toBeInTheDocument();
  });

  it('says so when the lists cannot be loaded', () => {
    flagLists({ error: new Error('Server responded with 403') });

    render(<Worklists />);

    expect(screen.getByText('Could not load the worklists')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('says so when there are no RHD flag lists', () => {
    flagLists({ lists: [] });

    render(<Worklists />);

    expect(screen.getByText('No RHD flag lists found')).toBeInTheDocument();
  });

  it('is closed to a user without the worklists privilege', async () => {
    await signInWith([], { screenPrivileges: { worklists: 'App: act.worklists' } as never });

    render(<Worklists />);

    expect(screen.getByText('You do not have access to the worklists.')).toBeInTheDocument();
    expect(screen.queryByTestId('worklist-tile')).not.toBeInTheDocument();
  });
});
