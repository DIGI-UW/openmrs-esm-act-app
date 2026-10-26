import React from 'react';
import dayjs from 'dayjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LineChart } from '@carbon/charts-react';
import { signInWith } from '../access/sign-in.test-helper';
import { type ClinicLimit, useClinicLimit } from '../clinic-limit';
import { useClinics } from '../programme-report/clinics.resource';
import { type RunChartPoint } from './run-chart-stats';
import { type RunChartParams, useRunChart } from './run-chart.resource';
import RunCharts from './run-charts.component';

vi.mock('./run-chart.resource', () => ({ useRunChart: vi.fn() }));
vi.mock('../clinic-limit', () => ({ useClinicLimit: vi.fn() }));
vi.mock('../programme-report/clinics.resource', () => ({ useClinics: vi.fn() }));
vi.mock('../act-page-header/act-page-header.component', () => ({
  ActPageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
// Carbon charts draw into an SVG the test DOM cannot lay out, so the chart only records its props.
vi.mock('@carbon/charts-react', async () => ({
  ...(await vi.importActual<object>('@carbon/charts-react')),
  LineChart: vi.fn(() => null),
}));

const GULU = { uuid: 'gulu-uuid', display: 'Gulu Regional Referral Hospital' };
const LIRA = { uuid: 'lira-uuid', display: 'Lira Regional Referral Hospital' };

const point = (index: number, value: number | null, total: number | null = null): RunChartPoint => ({
  date: dayjs('2026-01-05')
    .add(index * 7, 'day')
    .format('YYYY-MM-DD'),
  value,
  count: value === null ? 0 : total === null ? value : Math.round((value * total) / 100),
  total,
});
const series = (...values: Array<number | null>) => values.map((value, index) => point(index, value, 100));

function answer(
  points: Array<RunChartPoint>,
  median: number | null = null,
  lastSnapshot: string | null = '2026-10-21',
) {
  return { points, median, lastSnapshot, isLoading: false, error: undefined, mutate: vi.fn() };
}
const asks = () => vi.mocked(useRunChart).mock.calls.map(([params]) => params as RunChartParams | null);
const lastChartProps = () =>
  vi.mocked(LineChart).mock.calls.at(-1)?.[0] as never as {
    data: Array<{ group: string; date: Date; value: number }>;
    options: Record<string, any>;
  };
const limitTo = (limit: ClinicLimit) => vi.mocked(useClinicLimit).mockReturnValue(limit);

describe('RunCharts', () => {
  beforeEach(async () => {
    vi.mocked(useRunChart).mockReset();
    vi.mocked(LineChart).mockClear();
    vi.mocked(useRunChart).mockImplementation((params) => answer(params ? series(60, 70, 80) : []) as never);
    vi.mocked(useClinics).mockReturnValue([GULU, LIRA]);
    limitTo({ status: 'none' });
    await signInWith(['App: act.dashboard']);
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    window.history.replaceState({}, '', '/home/act-run-charts');
  });

  it('opens on a chosen metric, in weeks, over the last 12 months, for every clinic', () => {
    render(<RunCharts />);

    const [first] = asks();
    expect(first).toEqual({
      metric: 'active_registrants_seen_last_7_months',
      clinic: null,
      startDate: dayjs().subtract(12, 'month').format('YYYY-MM-DD'),
      endDate: dayjs().format('YYYY-MM-DD'),
      points: 'week',
    });
    expect(screen.getByRole('heading', { name: /Retained in care.*All clinics/ })).toBeInTheDocument();
    expect((screen.getByLabelText('Metric') as HTMLSelectElement).value).toBe('active_registrants_seen_last_7_months');
  });

  it('draws the points as a line and, with fewer than ten, no median', () => {
    render(<RunCharts />);

    const { data, options } = lastChartProps();
    expect(data.map((item) => [item.group, item.value])).toEqual([
      ['Value', 60],
      ['Value', 70],
      ['Value', 80],
    ]);
    expect(options.axes.bottom.highlights).toBeUndefined();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('draws the median and a band for each shift once there are ten points, as local days', () => {
    vi.mocked(useRunChart).mockImplementation(
      (params) => answer(params ? series(40, 80, 80, 80, 80, 80, 80, 40, 40, 40) : [], 80 - 1) as never,
    );
    render(<RunCharts />);

    const { data, options } = lastChartProps();
    expect(data.filter((item) => item.group === 'Median of the period').map((item) => item.value)).toEqual(
      Array(10).fill(79),
    );
    expect(options.axes.bottom.highlights.data).toEqual([
      {
        startHighlight: new Date(2026, 0, 12),
        endHighlight: new Date(2026, 1, 16),
        label: 'Shift: 6 in a row above the median',
      },
    ]);
    expect(options.axes.bottom.highlights.highlightStartMapsTo).toBe('startHighlight');
    expect(options.axes.bottom.highlights.highlightEndMapsTo).toBe('endHighlight');
  });

  it('holds a percent to 0 to 100 and leaves a count to its own scale', async () => {
    const user = userEvent.setup();
    render(<RunCharts />);
    expect(lastChartProps().options.axes.left.domain).toEqual([0, 100]);

    await user.selectOptions(screen.getByLabelText('Metric'), 'active_registrants');

    expect(lastChartProps().options.axes.left.domain).toBeUndefined();
  });

  it('names the week a point starts and the patient-days behind a percent in its tooltip', () => {
    render(<RunCharts />);

    const html = lastChartProps().options.tooltip.customHTML([
      { group: 'Value', date: new Date(2026, 0, 12), value: 70 },
    ]);

    expect(html).toContain('Week of');
    expect(html).toContain('70% · 70 of 100 patient-days');
    expect(
      lastChartProps().options.tooltip.customHTML([
        { group: 'Median of the period', date: new Date(2026, 0, 12), value: 5 },
      ]),
    ).toContain('Median 5');
  });

  it('says when the snapshots started and the latest figure before a chart can be drawn', () => {
    vi.mocked(useRunChart).mockImplementation((params) => {
      if (!params) {
        return answer([]) as never;
      }
      return answer(params.points === 'day' ? [point(0, 55, 100), point(1, 57, 100)] : [point(0, 57, 100)]) as never;
    });
    render(<RunCharts />);

    expect(screen.getByText(/Snapshots started on/)).toBeInTheDocument();
    expect(
      screen.getByText(/The chart appears after the second week; a median and shifts after 10 weeks/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Latest, .*: 57% · 57 of 100/)).toBeInTheDocument();
    expect(LineChart).not.toHaveBeenCalled();
    expect(asks().some((params) => params?.points === 'day')).toBe(true);
  });

  it('says no snapshot has been taken when there is none at all', () => {
    vi.mocked(useRunChart).mockImplementation((params) => answer([], null, null) as never);
    render(<RunCharts />);

    expect(screen.getByText(/No snapshot has been taken for All clinics yet/)).toBeInTheDocument();
  });

  it('shows each of the eight metrics as a tile with its latest value and its change', () => {
    render(<RunCharts />);

    const tiles = screen.getAllByTestId('run-chart-tile');
    expect(tiles).toHaveLength(8);
    expect(asks().map((params) => params?.metric)).toEqual(
      expect.arrayContaining(['total_registrants', 'interventions_completed']),
    );
    const retained = tiles.find((tile) => tile.textContent?.includes('Retained in care'))!;
    expect(within(retained).getByText('80%')).toBeInTheDocument();
    expect(within(retained).getByText(/\+20 points since/)).toBeInTheDocument();
    expect(retained).toHaveAttribute('aria-current', 'true');
    const total = tiles.find((tile) => tile.textContent?.includes('Total registrants'))!;
    expect(within(total).getByText(/\+20 since/)).toBeInTheDocument();
    expect(total).not.toHaveAttribute('aria-current');
  });

  it('says no change for a tile that has not moved, and shows a dash for one with no value', () => {
    vi.mocked(useRunChart).mockImplementation(
      (params) =>
        answer(
          !params
            ? []
            : params.metric === 'total_registrants'
              ? series(5, 5)
              : params.metric === 'active_registrants'
                ? series(null)
                : series(60, 70, 80),
        ) as never,
    );
    render(<RunCharts />);

    const tiles = screen.getAllByTestId('run-chart-tile');
    expect(
      within(tiles.find((tile) => tile.textContent?.includes('Total registrants'))!).getByText('no change'),
    ).toBeInTheDocument();
    expect(
      within(tiles.find((tile) => tile.textContent?.includes('Active registrants'))!).getByText('–'),
    ).toBeInTheDocument();
  });

  it('opens the chart of the tile clicked, in the same page', async () => {
    const user = userEvent.setup();
    render(<RunCharts />);

    await user.click(
      screen.getAllByTestId('run-chart-tile').find((tile) => tile.textContent?.includes('Total registrants'))!,
    );

    expect(asks().at(-1)?.metric).not.toBeUndefined();
    expect((screen.getByLabelText('Metric') as HTMLSelectElement).value).toBe('total_registrants');
    expect(screen.getByRole('heading', { name: /^Total registrants, All clinics/ })).toBeInTheDocument();
  });

  it('groups by day or month when asked', async () => {
    const user = userEvent.setup();
    render(<RunCharts />);

    await user.click(screen.getByRole('tab', { name: 'Day' }));
    expect(asks().at(-1)?.points).toBe('day');

    await user.click(screen.getByRole('tab', { name: 'Month' }));
    expect(asks().at(-1)?.points).toBe('month');
  });

  it('reads the filters from the page address, and asks for the clinic chosen', () => {
    window.history.replaceState(
      {},
      '',
      '/home/act-run-charts?metric=active_registrants&clinic=lira-uuid&points=month&from=2026-01-01&to=2026-06-30',
    );
    render(<RunCharts />);

    expect(asks()[0]).toEqual({
      metric: 'active_registrants',
      clinic: 'lira-uuid',
      startDate: '2026-01-01',
      endDate: '2026-06-30',
      points: 'month',
    });
    expect(screen.getByRole('heading', { name: /^Total registrants|^Active registrants, Lira/ })).toBeInTheDocument();
  });

  it('asks for nothing and says so when the range runs backwards', () => {
    window.history.replaceState({}, '', '/home/act-run-charts?from=2026-06-30&to=2026-01-01');
    render(<RunCharts />);

    expect(asks().every((params) => params === null)).toBe(true);
    expect(screen.getByText('The end is before the start')).toBeInTheDocument();
  });

  it('falls back to the default for a metric or period the address misnames', () => {
    window.history.replaceState({}, '', '/home/act-run-charts?metric=nonsense&points=year');
    render(<RunCharts />);

    expect(asks()[0]).toMatchObject({ metric: 'active_registrants_seen_last_7_months', points: 'week' });
  });

  it('offers a limited administrator only their clinics, never every clinic, whatever the address says', () => {
    limitTo({ status: 'ready', uuids: [GULU.uuid], names: [GULU.display] });
    vi.mocked(useClinics).mockReturnValue([GULU]);
    window.history.replaceState({}, '', '/home/act-run-charts?clinic=lira-uuid');
    render(<RunCharts />);

    const options = within(screen.getByLabelText('Clinic'))
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(options).toEqual([GULU.display]);
    expect(asks()[0]?.clinic).toBe(GULU.uuid);
    expect(asks().every((params) => params === null || params.clinic === GULU.uuid)).toBe(true);
  });

  it('asks a limited administrator for nothing while their clinics load, and says when they have none', () => {
    limitTo({ status: 'pending' });
    render(<RunCharts />);
    expect(asks().every((params) => params === null)).toBe(true);
  });

  it('says a limited administrator with no clinic has none to chart', () => {
    limitTo({ status: 'ready', uuids: [], names: [] });
    vi.mocked(useClinics).mockReturnValue([]);
    render(<RunCharts />);

    expect(screen.getByText('No clinic on your account to chart')).toBeInTheDocument();
    expect(asks().every((params) => params === null)).toBe(true);
  });

  it('says so, with a way to try again, when the run chart cannot load', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();
    vi.mocked(useRunChart).mockImplementation(
      (params) =>
        ({
          ...(answer([]) as object),
          error: params ? new Error('refused') : undefined,
          mutate,
        }) as never,
    );
    render(<RunCharts />);

    expect(screen.getByText('Could not load the run chart')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(mutate).toHaveBeenCalled();
  });

  it('shows a tile that cannot load beside the others, with its own way to try again', () => {
    vi.mocked(useRunChart).mockImplementation((params) =>
      params?.metric === 'total_registrants'
        ? ({ ...(answer([]) as object), error: new Error('refused') } as never)
        : (answer(params ? series(60, 70, 80) : []) as never),
    );
    render(<RunCharts />);

    expect(screen.getAllByRole('button', { name: /Could not load. Try again/ })).toHaveLength(1);
    expect(screen.getAllByTestId('run-chart-tile')).toHaveLength(8);
  });

  it('gives the chart a text alternative: its name, and its points and median as a table', () => {
    vi.mocked(useRunChart).mockImplementation(
      (params) => answer(params ? series(40, 80, 80, 80, 80, 80, 80, 40, 40, 40) : [], 80) as never,
    );
    render(<RunCharts />);

    expect(lastChartProps().options.accessibility.svgAriaLabel).toMatch(/Retained in care.*All clinics/);
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(11);
    expect(screen.getByText('Median 80')).toBeInTheDocument();
  });
});
