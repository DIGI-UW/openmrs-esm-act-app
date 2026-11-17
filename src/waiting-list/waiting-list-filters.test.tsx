import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { openmrsFetch } from '@openmrs/esm-framework';
import { atSessionLocation, signInWith } from '../access/sign-in.test-helper';
import { columnHeaders } from '../column-headers.test-helper';
import { useReportDataset } from '../reports/report-dataset.resource';
import { waitingListRows } from './waiting-list.fixture';
import WaitingList from './waiting-list.component';

vi.mock('../reports/report-dataset.resource', () => ({ useReportDataset: vi.fn() }));

const rows = waitingListRows.map((row, i) => ({
  ...row,
  // The answers' names, as the report gives them; the list shows each by its band's label.
  urgency: ['1: emergent (24 hours)', '2: urgent (60 days/2 months)', '3: elective (180 days/6 months)'][i % 3],
  urgency_concept: [
    '1fe15210-4490-58b0-a38c-bb0386e98482',
    '33bf504a-15f2-5504-9bdc-ddded0b5eb00',
    '2666bf97-7400-57c7-b535-7903e22ced34',
  ][i % 3],
  date_added: '2026-09-28',
}));

function shownIds() {
  const headers = columnHeaders();
  return screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[headers.indexOf('ACT ID')].textContent);
}

function options(label: string) {
  return within(screen.getByLabelText(label))
    .getAllByRole('option')
    .map((option) => option.textContent);
}

async function choose(label: string, option: string) {
  await userEvent.selectOptions(screen.getByLabelText(label), option);
}

async function downloadedCsv() {
  const createObjectURL = vi.fn((blob: Blob) => 'blob:waiting-list');
  window.URL.createObjectURL = createObjectURL as never;
  window.URL.revokeObjectURL = vi.fn();
  // The download is recorded through ACT Core before the file is made.
  vi.mocked(openmrsFetch).mockResolvedValue({ data: {} } as never);
  await userEvent.click(screen.getByRole('button', { name: /download csv/i }));
  await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
  return (createObjectURL.mock.calls[0][0] as Blob).text();
}

describe('Procedural waiting list filters and CSV', () => {
  beforeEach(async () => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    window.history.replaceState(null, '', '/openmrs/spa/home/act-waiting-list');
    await signInWith(['App: act.waitingList', 'Task: act.lists.export']);
    vi.mocked(useReportDataset).mockReturnValue({
      columns: [],
      rows,
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });
  });

  it("opens on the recommendations of the session's cardiac clinic", async () => {
    atSessionLocation('Gulu RRH', ['RHD District']);

    render(<WaitingList />);

    await waitFor(() => expect(screen.getByLabelText('Cardiac clinic')).toHaveValue('Gulu RRH'));
    const gulu = rows.filter((row) => row.cardiac_clinic === 'Gulu RRH').map((row) => row.rhd_id);
    expect(shownIds().length).toBeGreaterThan(0);
    expect(shownIds().filter((id) => !gulu.includes(id))).toEqual([]);
  });

  it("says it could not load, rather than every clinic's recommendations, when the session location's kind cannot be read", async () => {
    atSessionLocation('Gulu RRH', ['RHD District'], 'unreadable-waiting-list');
    vi.mocked(openmrsFetch).mockRejectedValue(new Error('Internal Server Error'));

    render(<WaitingList />);

    expect(await screen.findByText('Could not load the procedural waiting list')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('offers each filter the values the recommendations have', () => {
    render(<WaitingList />);

    expect(options('Cardiac clinic')).toEqual(['All', 'Gulu RRH', 'Lira RRH']);
    expect(options('Primary care clinic')).toEqual(['All', 'Anyeke HCIV']);
    expect(options('Procedure type')).toEqual(['All', 'Catheterization', 'Surgery']);
    expect(options('Specific procedure')).toEqual([
      'All',
      'Mitral balloon valvuloplasty',
      'Mitral valve repair/replacement',
    ]);
    expect(options('Urgency')).toEqual(['All', 'urgencyEmergent', 'urgencyUrgent', 'urgencyElective']);
  });

  it("keeps offering every recommendation's values once a filter is set, so another can be picked", async () => {
    render(<WaitingList />);

    await choose('Cardiac clinic', 'Gulu RRH');
    await choose('Procedure type', 'Catheterization');

    expect(options('Cardiac clinic')).toEqual(['All', 'Gulu RRH', 'Lira RRH']);
    expect(options('Procedure type')).toEqual(['All', 'Catheterization', 'Surgery']);
    expect(options('Urgency')).toEqual(['All', 'urgencyEmergent', 'urgencyUrgent', 'urgencyElective']);
  });

  it.each([
    ['Cardiac clinic', 'Gulu RRH', (i: number) => i % 2 === 1],
    ['Primary care clinic', 'Anyeke HCIV', (i: number) => i % 2 === 1],
    ['Procedure type', 'Catheterization', (i: number) => i % 3 === 0],
    ['Specific procedure', 'Mitral valve repair/replacement', (i: number) => i % 3 !== 0],
    ['Urgency', 'urgencyUrgent', (i: number) => i % 3 === 1],
  ])('narrows the rows by %s', async (label, option, kept) => {
    render(<WaitingList />);
    await userEvent.selectOptions(screen.getByLabelText(/items per page/i), '50');

    await choose(label, option);

    const expected = rows.filter((_, i) => kept(i)).map((row) => row.rhd_id);
    expect([...shownIds()].sort()).toEqual([...expected].sort());
  });

  it('shows the right rows after a filter change when one consultation recommends the same procedure twice', async () => {
    const twice = [
      {
        ...rows[1],
        recommendation_uuid: 'first',
        urgency: '1: emergent (24 hours)',
        urgency_concept: rows[0].urgency_concept,
      },
      { ...rows[1], recommendation_uuid: 'second' },
      rows[0],
    ];
    vi.mocked(useReportDataset).mockReturnValue({
      columns: [],
      rows: twice,
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });
    render(<WaitingList />);

    await choose('Urgency', 'urgencyEmergent');
    await choose('Procedure type', 'Catheterization');
    await choose('Procedure type', '');
    await choose('Urgency', '');

    expect(screen.getAllByRole('row')).toHaveLength(1 + twice.length);
    await choose('Procedure type', 'Catheterization');
    expect(shownIds()).toEqual([rows[0].rhd_id]);
  });

  it('keeps the filters in the URL and restores them from it', async () => {
    const { unmount } = render(<WaitingList />);
    await choose('Procedure type', 'Surgery');
    await choose('Urgency', 'urgencyUrgent');
    await waitFor(() => expect(new URLSearchParams(window.location.search).get('urgency')).toBe('urgencyUrgent'));
    expect(new URLSearchParams(window.location.search).get('type')).toBe('Surgery');
    unmount();

    render(<WaitingList />);

    expect(screen.getByLabelText('Procedure type')).toHaveValue('Surgery');
    expect(screen.getByLabelText('Urgency')).toHaveValue('urgencyUrgent');
    const expected = rows.filter((_, i) => i % 3 === 1).map((row) => row.rhd_id);
    expect(expected.length).toBeGreaterThan(0);
    expect([...shownIds()].sort()).toEqual([...expected].sort());
  });

  it('says so when no recommendation matches the filters', async () => {
    window.history.replaceState(null, '', '/openmrs/spa/home/act-waiting-list?procedure=Old+procedure');

    render(<WaitingList />);

    expect(screen.getByLabelText('Specific procedure')).toHaveValue('Old procedure');
    expect(screen.getByTestId('filter-empty-state')).toHaveTextContent(
      'No recommendations to displayCheck the filters above',
    );
  });

  it('includes rows past the first page in the CSV', async () => {
    render(<WaitingList />);

    const lines = (await downloadedCsv()).trim().split('\r\n');

    expect(lines).toHaveLength(1 + rows.length);
  });

  it('goes back to the first page when a filter changes', async () => {
    const twoPagesEach = [
      ...rows,
      ...rows.map((row) => ({
        ...row,
        rhd_id: `${row.rhd_id}b`,
        recommendation_uuid: `${row.recommendation_uuid}b`,
        encounter_uuid: `${row.encounter_uuid}b`,
      })),
    ];
    vi.mocked(useReportDataset).mockReturnValue({
      columns: [],
      rows: twoPagesEach,
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });
    render(<WaitingList />);
    await userEvent.click(screen.getByRole('button', { name: /next page/i }));

    expect(screen.getByText(/11–20 of/)).toBeInTheDocument();
    await choose('Cardiac clinic', 'Lira RRH');

    expect(screen.getByText(/1–10 of/)).toBeInTheDocument();
  });

  it('downloads the filtered rows from every page, with the visible columns', async () => {
    render(<WaitingList />);
    await choose('Procedure type', 'Surgery');

    const lines = (await downloadedCsv()).trim().split('\r\n');

    expect(lines[0]).toBe(
      'ACT ID,Sex,Age,Date of birth,Type,Procedure,Urgency,Days pending,District,Contraindications,Suitable for repair',
    );
    expect(lines).toHaveLength(1 + rows.filter((row) => row.procedure_type === 'Surgery').length);
    expect(lines.slice(1).every((line) => line.split(',')[4] === 'Surgery')).toBe(true);
  });
});
