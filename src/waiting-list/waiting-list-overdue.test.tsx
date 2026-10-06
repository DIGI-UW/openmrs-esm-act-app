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
// ACT 2.0's urgency answers, as the distro's concepts define them.
const [emergent, urgent, elective] = [
  '1fe15210-4490-58b0-a38c-bb0386e98482',
  '33bf504a-15f2-5504-9bdc-ddded0b5eb00',
  '2666bf97-7400-57c7-b535-7903e22ced34',
];

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
    await signInWith(['App: act.waitingList']);
  });

  afterEach(() => vi.useRealTimers());

  it("defaults to ACT 2.0's three urgencies, due in 24 hours, 60 days and 180 days, with the four answers they replaced, by deadline", () => {
    expect(urgencyBands.map((band) => [band.concept, band.deadlineDays, band.label, band.shortLabel])).toEqual([
      [emergent, 1, '1: Emergent (24 hours)', '1: Emergent'],
      ['406285f2-be72-5594-8664-c8568ad9bc88', 7, '1 - within 1 week', undefined],
      ['82c5209b-c183-5bc9-941c-890eba821a44', 30, '2 - within 1 month', undefined],
      [urgent, 60, '2: Urgent (60 days)', '2: Urgent'],
      ['925610f9-1c3c-5396-880f-02a5fe309d53', 90, '3 - within 3 months', undefined],
      [elective, 180, '3: Elective (180 days)', '3: Elective'],
      ['57e3873e-018e-5ed6-b7d4-5f73ef464cbd', 180, '4 - within 6 months', undefined],
    ]);
  });

  it('keeps a recommendation saved with a replaced answer on its old deadline, ranked by that deadline', () => {
    vi.mocked(useReportDataset).mockReturnValue({
      columns: [],
      rows: [
        row('week-6', '406285f2-be72-5594-8664-c8568ad9bc88', 6),
        row('week-8-overdue', '406285f2-be72-5594-8664-c8568ad9bc88', 8),
        row('elective-10', elective, 10),
      ],
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });

    render(<WaitingList />);

    expect(shown()).toEqual([
      { id: 'week-8-overdue', days: '8', overdue: true },
      { id: 'week-6', days: '6', overdue: false },
      { id: 'elective-10', days: '10', overdue: false },
    ]);
  });

  it.each([
    ['an emergent', emergent, 1],
    ['an urgent', urgent, 60],
    ['an elective', elective, 180],
  ])('turns %s recommendation red and lists it first once it is past its deadline', (_, concept, deadline) => {
    vi.mocked(useReportDataset).mockReturnValue({
      columns: [],
      rows: [row('on', concept, deadline), row('past', concept, deadline + 1)],
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });

    render(<WaitingList />);

    expect(shown()).toEqual([
      { id: 'past', days: String(deadline + 1), overdue: true },
      { id: 'on', days: String(deadline), overdue: false },
    ]);
  });

  it("shows each urgency by its band's label rather than the answer's name", () => {
    vi.mocked(useReportDataset).mockReturnValue({
      columns: [],
      rows: [
        { ...row('emergent', emergent, 0), urgency: '1: emergent (24 hours)' },
        { ...row('unbanded', 'some-other-concept', 0), urgency: '2 - within 1 month' },
      ],
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });

    render(<WaitingList />);

    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent);
    const urgencies = screen
      .getAllByRole('row')
      .slice(1)
      .map((tr) => within(tr).getAllByRole('cell')[headers.indexOf('Urgency')].textContent);
    expect(urgencies).toEqual(['1: Emergent (24 hours)', '2 - within 1 month']);
  });

  it('counts whole days, so an afternoon view shows the same days pending as a morning one', () => {
    vi.setSystemTime(new Date(2026, 8, 29, 23, 30));
    const band = urgencyBands[0];
    vi.mocked(useReportDataset).mockReturnValue({
      columns: [],
      rows: [row('on', band.concept, band.deadlineDays)],
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });

    render(<WaitingList />);

    expect(shown()).toEqual([{ id: 'on', days: String(band.deadlineDays), overdue: false }]);
  });

  it('says under the title what the list holds and what a red row means', () => {
    vi.mocked(useReportDataset).mockReturnValue({
      columns: [],
      rows: [],
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });

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
      mutate: vi.fn(),
    });

    render(<WaitingList />);

    expect(shown()).toEqual([{ id: 'unbanded', days: '400', overdue: false }]);
  });

  it('lists overdue rows first, then by urgency, then the longest waiting first', () => {
    vi.mocked(useReportDataset).mockReturnValue({
      columns: [],
      rows: [
        row('elective-10', elective, 10),
        row('emergent-1', emergent, 1),
        row('urgent-70-overdue', urgent, 70),
        row('elective-50', elective, 50),
        row('emergent-9-overdue', emergent, 9),
        row('unbanded', 'some-other-concept', 5),
      ],
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
    });

    render(<WaitingList />);

    expect(shown().map((r) => r.id)).toEqual([
      'emergent-9-overdue',
      'urgent-70-overdue',
      'emergent-1',
      'elective-50',
      'elective-10',
      'unbanded',
    ]);
  });

  it('marks only the Days pending cell, which the stylesheet colours red on an overdue row', () => {
    vi.mocked(useReportDataset).mockReturnValue({
      columns: [],
      rows: [row('past', urgencyBands[0].concept, urgencyBands[0].deadlineDays + 1)],
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
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
      mutate: vi.fn(),
    });

    render(<WaitingList />);

    expect(shown()).toEqual([{ id: 'array', days: '10', overdue: true }]);
  });
});
