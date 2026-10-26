import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { signInWith } from '../access/sign-in.test-helper';
import { columnHeaders } from '../column-headers.test-helper';
import { layouts, setLayout, tableSkeleton } from '../table-skeleton.test-helper';
import { markTranslations } from '../i18n.test-helper';
import { useReportDataset } from '../reports/report-dataset.resource';
import { waitingListRows } from './waiting-list.fixture';
import WaitingList from './waiting-list.component';

vi.mock('../reports/report-dataset.resource', () => ({ useReportDataset: vi.fn() }));
const mockUseReportDataset = vi.mocked(useReportDataset);

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

describe('Procedural waiting list', () => {
  beforeEach(async () => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    window.history.replaceState(null, '', '/openmrs/spa/home/act-waiting-list');
    await signInWith(['App: act.waitingList']);
  });

  it("lists each open recommendation with its patient's ACT ID, sex, age, type, procedure, urgency, district, contraindications and repair suitability", () => {
    dataset({ rows: waitingListRows });

    render(<WaitingList />);

    const headers = columnHeaders();
    expect(headers.slice(0, 7)).toEqual(['ACT ID', 'Sex', 'Age', 'Date of birth', 'Type', 'Procedure', 'Urgency']);
    expect(headers).toEqual(expect.arrayContaining(['District', 'Contraindications', 'Suitable for repair']));
    const cells = (id: string) =>
      Object.fromEntries(
        within(screen.getByRole('row', { name: new RegExp(`${id}\\b`) }))
          .getAllByRole('cell')
          .map((cell, i) => [headers[i], cell.textContent]),
      );
    expect(cells('rhd00001')).toMatchObject({
      'ACT ID': 'rhd00001',
      Sex: 'F',
      Age: '10',
      'Date of birth': '15-Mar-2016',
      Type: 'Catheterization',
      Procedure: 'Mitral balloon valvuloplasty',
      Urgency: 'urgencyElective',
      District: 'KITGUM',
      Contraindications: 'Yes',
      'Suitable for repair': 'No',
    });
  });

  describe('sorting', () => {
    const shownIds = () =>
      screen
        .getAllByRole('row')
        .slice(1)
        .map((row) => within(row).getAllByRole('cell')[0].textContent);
    const sortBy = (header: string) => userEvent.click(screen.getByRole('button', { name: new RegExp(`^${header}`) }));
    const rows = [
      { ...waitingListRows[0], rhd_id: 'a', age_years: 100, date_of_birth: '2000-02-01', date_added: '2026-09-01' },
      { ...waitingListRows[1], rhd_id: 'b', age_years: 9, date_of_birth: '2001-03-01', date_added: '2026-06-01' },
      { ...waitingListRows[2], rhd_id: 'c', age_years: 50, date_of_birth: '2000-01-01', date_added: '2026-09-01' },
    ];

    it('sorts by any column, a number by its value and a date by its day, then returns to the ranking', async () => {
      dataset({ rows });
      render(<WaitingList />);
      const ranked = shownIds();

      await sortBy('Age');
      expect(shownIds()).toEqual(['b', 'c', 'a']);
      await sortBy('Age');
      expect(shownIds()).toEqual(['a', 'c', 'b']);
      await sortBy('Age');
      expect(shownIds()).toEqual(ranked);
      await sortBy('Date of birth');
      expect(shownIds()).toEqual(['c', 'a', 'b']);
    });

    it('sorts by days pending, the most pending last when ascending', async () => {
      dataset({ rows });
      render(<WaitingList />);

      await sortBy('Days pending');

      expect(shownIds()[2]).toBe('b');
    });
  });

  it("offers each urgency band's name to translation, in its column and its filter alike, filtering by the configured name", async () => {
    markTranslations();
    dataset({ rows: waitingListRows });

    render(<WaitingList />);

    const row = screen.getByRole('row', { name: /rhd00001\b/ });
    expect(within(row).getByRole('cell', { name: '«urgencyElective»' })).toBeInTheDocument();
    const urgency = screen.getByRole('combobox', { name: '«Urgency»' });
    await userEvent.selectOptions(urgency, screen.getByRole('option', { name: '«urgencyElective»' }));
    expect(urgency).toHaveValue('urgencyElective');
  });

  it("shows the report's own urgency name, which no band covers, as it is", async () => {
    markTranslations();
    dataset({ rows: [{ ...waitingListRows[0], urgency: 'Urgent', urgency_concept: 'no-such-band' }] });

    render(<WaitingList />);

    expect(screen.getByRole('cell', { name: 'Urgent' })).toBeInTheDocument();
    const urgency = screen.getByRole('combobox', { name: '«Urgency»' });
    await userEvent.selectOptions(urgency, screen.getByRole('option', { name: 'Urgent' }));
    expect(urgency).toHaveValue('Urgent');
  });

  it('evaluates the configured report', () => {
    dataset({ rows: waitingListRows });

    render(<WaitingList />);

    expect(mockUseReportDataset).toHaveBeenLastCalledWith('5b0f1c2e-9d3a-4c1b-8f6e-2a7d9e4b3c10');
  });

  it('shows the recommendations a page at a time', async () => {
    dataset({ rows: waitingListRows });

    render(<WaitingList />);

    expect(screen.getAllByRole('row')).toHaveLength(1 + 10);
    await userEvent.click(screen.getByRole('button', { name: /next page/i }));
    expect(screen.getByText(/11–20 of 30 items/)).toBeInTheDocument();
  });

  it('says so when no recommendation is open', () => {
    dataset({ rows: [] });

    render(<WaitingList />);

    expect(screen.getByTestId('table-empty-state')).toHaveTextContent(
      'There are no procedural recommendations to display',
    );
  });

  it('says so when the report cannot be loaded', () => {
    dataset({ error: new Error('Server responded with 404') });

    render(<WaitingList />);

    expect(screen.getByText('Could not load the procedural waiting list')).toBeInTheDocument();
  });

  it.each(layouts)(
    'loads as a table skeleton of a page of rows, sized as its table on $layout',
    ({ layout, compact, size }) => {
      setLayout(layout);
      dataset({ isLoading: true });
      const { rerender } = render(<WaitingList />);

      const { skeleton, rows, columns } = tableSkeleton();
      expect({ rows, columns }).toEqual({ rows: 10, columns: 12 });
      expect(skeleton.className.includes('cds--data-table--compact')).toBe(compact);
      dataset({ rows: waitingListRows });
      rerender(<WaitingList />);
      expect(screen.getByRole('table')).toHaveClass(`cds--data-table--${size}`);
    },
  );
});
