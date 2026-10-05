import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { navigate } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { layouts, setLayout, tableSkeleton } from '../table-skeleton.test-helper';
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

const worklistsPrivilege = 'App: act.worklists';

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
    ).toEqual(['Patient', 'Age, sex', 'Diagnosis', 'Prophylaxis', 'Days on list', '']);
    const [first] = within(table).getAllByRole('row').slice(1);
    expect(
      within(first)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['Patient 1rhd00001', '11 M', 'RHD B', 'Q28 day BPG', '', 'Open chart']);
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
    expect(screen.getByTestId('table-empty-state')).toHaveTextContent('There are no patients on this list to display');
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

  it.each(layouts)(
    'loads as a table skeleton of a page of rows, sized as its table on $layout',
    ({ layout, compact, size }) => {
      setLayout(layout);
      dataset({ isLoading: true });
      const { rerender } = render(<Worklists />);

      const { skeleton, rows: rowCount, columns } = tableSkeleton();
      expect({ rows: rowCount, columns }).toEqual({ rows: 10, columns: 6 });
      expect(skeleton.className.includes('cds--data-table--compact')).toBe(compact);
      dataset({ rows: rows });
      rerender(<Worklists />);
      expect(screen.getByRole('table')).toHaveClass(`cds--data-table--${size}`);
    },
  );

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

  it('lists every flag at once from the All flags tile, a row per patient and flag, with the flag named', async () => {
    render(<Worklists />);

    await userEvent.click(screen.getByRole('button', { name: /All flags/ }));

    expect(screen.getByTestId('worklist-all-tile')).toHaveTextContent('3All flags');
    expect(screen.getByRole('heading', { name: 'All flags' })).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(
      within(table)
        .getAllByRole('row')
        .slice(1)
        .map((r) =>
          within(r)
            .getAllByRole('cell')
            .slice(0, 2)
            .map((cell) => cell.textContent),
        ),
    ).toEqual([
      ['Patient 1rhd00001', 'RHD INR target missing'],
      ['Patient 1rhd00001', 'RHD prophylaxis overdue'],
      ['Patient 2rhd00002', 'RHD INR target missing'],
    ]);
    await waitFor(() => expect(window.location.search).toBe('?flag=all'));
  });

  it("counts each patient's days on the chosen list from the day they joined it", () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 3, 10), shouldAdvanceTime: true });
    window.history.replaceState(null, '', '/openmrs/spa/home/act-worklists?flag=RHD+INR+target+missing');
    dataset({
      rows: [
        { ...rows[0], rhd_flag_dates: 'RHD INR target missing=2026-09-23|RHD prophylaxis overdue=2026-10-01' },
        rows[1],
      ],
    });

    render(<Worklists />);

    vi.useRealTimers();
    const daysOnList = within(screen.getByRole('table'))
      .getAllByRole('row')
      .slice(1)
      .map((r) => within(r).getAllByRole('cell')[4].textContent);
    expect(daysOnList).toEqual(['10', '']);
  });

  it('narrows the patients by cardiac and primary care clinic', async () => {
    window.history.replaceState(null, '', '/openmrs/spa/home/act-worklists?flag=RHD+INR+target+missing');
    dataset({
      rows: [
        { ...rows[0], cardiac_clinic: 'Gulu RRH', primary_care_clinic: 'Anyeke HCIV' },
        { ...rows[1], cardiac_clinic: 'Lira RRH', primary_care_clinic: 'Anyeke HCIV' },
      ],
    });
    render(<Worklists />);

    await userEvent.selectOptions(screen.getByLabelText('Cardiac clinic'), 'Lira RRH');
    expect(shownNames()).toEqual(['Patient 2rhd00002']);

    await userEvent.selectOptions(screen.getByLabelText('Cardiac clinic'), '');
    await userEvent.selectOptions(screen.getByLabelText('Primary care clinic'), 'Anyeke HCIV');
    expect(shownNames()).toEqual(['Patient 1rhd00001', 'Patient 2rhd00002']);
  });
});
