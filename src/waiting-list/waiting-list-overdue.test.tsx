import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { getDefaultsFromConfigSchema } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { type Config, configSchema } from '../config-schema';
import { useReportDataset } from '../reports/report-dataset.resource';
import { waitingListRows } from './waiting-list.fixture';
import WaitingList from './waiting-list.component';

vi.mock('../reports/report-dataset.resource', () => ({ useReportDataset: vi.fn() }));

const { urgencyBands } = getDefaultsFromConfigSchema(configSchema) as Config;

function daysAgo(days: number) {
  const date = new Date(2026, 8, 29);
  date.setDate(date.getDate() - days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function row(id: string, concept: string, days: number) {
  return { ...waitingListRows[0], rhd_id: id, urgency_concept: concept, date_added: daysAgo(days), encounter_uuid: id };
}

function shown() {
  const headers = screen.getAllByRole('columnheader').map((header) => header.textContent);
  return screen
    .getAllByRole('row')
    .slice(1)
    .map((tr) => {
      const cells = within(tr).getAllByRole('cell');
      return {
        id: cells[headers.indexOf('ACT ID')].textContent,
        days: cells[headers.indexOf('Days pending')].textContent,
        overdue: tr.getAttribute('data-overdue') === 'true',
      };
    });
}

describe('Procedural waiting list days pending and overdue rows', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 29, 10), toFake: ['Date'] });
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    window.history.replaceState(null, '', '/openmrs/spa/home/act-waiting-list');
    await signInWith(['View Patient Flags']);
  });

  afterEach(() => vi.useRealTimers());

  it('defaults to the consultation form four urgency answers, due in 7, 30, 90 and 180 days', () => {
    expect(urgencyBands.map((band) => [band.concept, band.deadlineDays])).toEqual([
      ['406285f2-be72-5594-8664-c8568ad9bc88', 7],
      ['82c5209b-c183-5bc9-941c-890eba821a44', 30],
      ['925610f9-1c3c-5396-880f-02a5fe309d53', 90],
      ['57e3873e-018e-5ed6-b7d4-5f73ef464cbd', 180],
    ]);
  });

  it.each(urgencyBands.map((band) => [band.label, band] as const))(
    'marks a %s recommendation overdue once it is past its deadline, not on it',
    (_, band) => {
      vi.mocked(useReportDataset).mockReturnValue({
        columns: [],
        rows: [row('on', band.concept, band.deadlineDays), row('past', band.concept, band.deadlineDays + 1)],
        isLoading: false,
        error: undefined,
      });

      render(<WaitingList />);

      expect(shown()).toEqual([
        { id: 'past', days: String(band.deadlineDays + 1), overdue: true },
        { id: 'on', days: String(band.deadlineDays), overdue: false },
      ]);
    },
  );

  it('counts whole days, so an afternoon view shows the same days pending as a morning one', () => {
    vi.setSystemTime(new Date(2026, 8, 29, 23, 30));
    const week = urgencyBands[0];
    vi.mocked(useReportDataset).mockReturnValue({
      columns: [],
      rows: [row('on', week.concept, week.deadlineDays)],
      isLoading: false,
      error: undefined,
    });

    render(<WaitingList />);

    expect(shown()).toEqual([{ id: 'on', days: String(week.deadlineDays), overdue: false }]);
  });

  it('says under the title what the list holds and what a red row means', () => {
    vi.mocked(useReportDataset).mockReturnValue({ columns: [], rows: [], isLoading: false, error: undefined });

    render(<WaitingList />);

    expect(
      screen.getByText(
        'Open procedural recommendations from the latest consultation · red rows are past the deadline for their urgency',
      ),
    ).toBeInTheDocument();
  });

  it('never marks an urgency no band names as overdue', () => {
    vi.mocked(useReportDataset).mockReturnValue({
      columns: [],
      rows: [row('unbanded', 'some-other-concept', 400)],
      isLoading: false,
      error: undefined,
    });

    render(<WaitingList />);

    expect(shown()).toEqual([{ id: 'unbanded', days: '400', overdue: false }]);
  });

  it('lists overdue rows first, then by urgency, then the longest waiting first', () => {
    const [week, month, threeMonths] = urgencyBands.map((band) => band.concept);
    vi.mocked(useReportDataset).mockReturnValue({
      columns: [],
      rows: [
        row('three-months-10', threeMonths, 10),
        row('week-3', week, 3),
        row('month-40-overdue', month, 40),
        row('three-months-50', threeMonths, 50),
        row('week-9-overdue', week, 9),
        row('unbanded', 'some-other-concept', 5),
      ],
      isLoading: false,
      error: undefined,
    });

    render(<WaitingList />);

    expect(shown().map((r) => r.id)).toEqual([
      'week-9-overdue',
      'month-40-overdue',
      'week-3',
      'three-months-50',
      'three-months-10',
      'unbanded',
    ]);
  });

  it('marks only the Days pending cell, which the stylesheet colours red on an overdue row', () => {
    vi.mocked(useReportDataset).mockReturnValue({
      columns: [],
      rows: [row('past', urgencyBands[0].concept, urgencyBands[0].deadlineDays + 1)],
      isLoading: false,
      error: undefined,
    });

    render(<WaitingList />);

    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent);
    const marked = within(screen.getAllByRole('row')[1])
      .getAllByRole('cell')
      .map((cell, i) => [headers[i], cell.getAttribute('data-days-pending')])
      .filter(([, marker]) => marker !== null);
    expect(marked).toEqual([['Days pending', 'true']]);
  });

  it('reads the date the report sends as a Java date array', () => {
    vi.mocked(useReportDataset).mockReturnValue({
      columns: [],
      rows: [{ ...row('array', urgencyBands[0].concept, 0), date_added: [2026, 9, 19, 0, 0] }],
      isLoading: false,
      error: undefined,
    });

    render(<WaitingList />);

    expect(shown()).toEqual([{ id: 'array', days: '10', overdue: true }]);
  });
});
