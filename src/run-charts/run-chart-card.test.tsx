import React from 'react';
import dayjs from 'dayjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LineChart } from '@carbon/charts-react';
import { signInWith } from '../access/sign-in.test-helper';
import { type ClinicLimit, useClinicLimit } from '../clinic-limit';
import { useClinics } from '../programme-report/clinics.resource';
import { RunChartCard } from './run-chart-card.component';
import { type RunChartPoint } from './run-chart-stats';
import { type RunChartParams, useRunChart } from './run-chart.resource';

vi.mock('./run-chart.resource', () => ({ useRunChart: vi.fn() }));
vi.mock('../clinic-limit', () => ({ useClinicLimit: vi.fn() }));
vi.mock('../programme-report/clinics.resource', () => ({ useClinics: vi.fn() }));
vi.mock('@carbon/charts-react', async () => ({
  ...(await vi.importActual<object>('@carbon/charts-react')),
  LineChart: vi.fn(() => null),
}));

const GULU = { uuid: 'gulu-uuid', display: 'Gulu Regional Referral Hospital' };
const ACIMI = { uuid: 'acimi-uuid', display: 'Acimi HCIII' };

const point = (index: number, value: number | null): RunChartPoint => ({
  date: dayjs('2026-01-05')
    .add(index * 7, 'day')
    .format('YYYY-MM-DD'),
  value,
  count: value,
  total: 100,
});
const answer = (points: Array<RunChartPoint>, median: number | null = null) => ({
  points,
  median,
  lastSnapshot: '2026-10-21',
  isLoading: false,
  error: undefined,
  mutate: vi.fn(),
});
const asks = () => vi.mocked(useRunChart).mock.calls.map(([params]) => params as RunChartParams | null);
const limitTo = (limit: ClinicLimit) => vi.mocked(useClinicLimit).mockReturnValue(limit);

describe('RunChartCard', () => {
  beforeEach(async () => {
    vi.mocked(useRunChart).mockReset();
    vi.mocked(LineChart).mockClear();
    vi.mocked(useRunChart).mockImplementation(
      (params) => answer(params ? [point(0, 60), point(1, 70), point(2, 82)] : []) as never,
    );
    vi.mocked(useClinics).mockReturnValue([GULU, ACIMI]);
    limitTo({ status: 'none' });
    await signInWith(['App: act.dashboard']);
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
  });

  it('charts retained in care in weeks over the last 12 months, for every clinic when none is chosen', () => {
    render(<RunChartCard scope={{}} />);

    expect(asks()[0]).toEqual({
      metric: 'active_registrants_seen_last_7_months',
      clinic: null,
      startDate: dayjs().subtract(12, 'month').format('YYYY-MM-DD'),
      endDate: dayjs().format('YYYY-MM-DD'),
      points: 'week',
    });
    expect(screen.getByRole('heading', { name: 'Run charts', level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Retained in care.*All clinics/ })).toBeInTheDocument();
    expect(LineChart).toHaveBeenCalled();
  });

  it('never calls a chosen clinic All clinics while the clinic list loads', () => {
    vi.mocked(useClinics).mockReturnValue([]);
    render(<RunChartCard scope={{ primaryCareClinic: ACIMI.uuid }} />);

    expect(screen.getByRole('heading', { name: /Retained in care.*, acimi-uuid$/ })).toBeInTheDocument();
  });

  it('shows the latest value with the figures behind it, and no median before there is one', () => {
    render(<RunChartCard scope={{}} />);

    expect(screen.getByTestId('run-chart-latest')).toHaveTextContent('82% · 82 of 100 patient-days');
    expect(screen.queryByText(/^Median/)).not.toBeInTheDocument();
  });

  it('names the clinic charted, the primary care clinic when both are chosen, and links to the page for it', () => {
    render(<RunChartCard scope={{ cardiacClinic: GULU.uuid, primaryCareClinic: ACIMI.uuid }} />);

    expect(asks()[0]?.clinic).toBe(ACIMI.uuid);
    expect(screen.getByRole('heading', { name: /Retained in care.*Acimi HCIII/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open run charts/ })).toHaveAttribute(
      'href',
      `/openmrs/spa/home/act-run-charts?metric=active_registrants_seen_last_7_months&clinic=${ACIMI.uuid}`,
    );
  });

  it('charts the cardiac clinic when only it is chosen', () => {
    render(<RunChartCard scope={{ cardiacClinic: GULU.uuid }} />);

    expect(asks()[0]?.clinic).toBe(GULU.uuid);
  });

  it('holds a limited administrator to their own clinic, never every clinic, and asks for nothing while it is read', () => {
    limitTo({ status: 'pending' });
    const { unmount } = render(<RunChartCard scope={{}} />);
    expect(asks().every((params) => params === null)).toBe(true);
    unmount();

    vi.mocked(useRunChart).mockClear();
    limitTo({ status: 'ready', uuids: [ACIMI.uuid], names: [ACIMI.display] });
    render(<RunChartCard scope={{ cardiacClinic: GULU.uuid }} />);

    expect(asks().every((params) => params?.clinic === ACIMI.uuid)).toBe(true);
  });

  it('says a limited administrator with no clinic has none to chart', () => {
    limitTo({ status: 'ready', uuids: [], names: [] });
    render(<RunChartCard scope={{}} />);

    expect(screen.getByText('No clinic on your account to chart')).toBeInTheDocument();
    expect(asks().every((params) => params === null)).toBe(true);
  });

  it('says when the snapshots started instead of a chart before there is a second point', () => {
    vi.mocked(useRunChart).mockImplementation(
      (params) =>
        answer(params ? (params.points === 'day' ? [point(0, 55), point(1, 57)] : [point(0, 57)]) : []) as never,
    );
    render(<RunChartCard scope={{}} />);

    expect(screen.getByText(/Snapshots started on/)).toBeInTheDocument();
    expect(LineChart).not.toHaveBeenCalled();
  });

  it('says so, beside the rest of the Dashboard, with a way to try again, when the run chart cannot load', async () => {
    const user = userEvent.setup();
    const mutate = vi.fn();
    vi.mocked(useRunChart).mockImplementation(
      (params) => ({ ...answer([]), error: params ? new Error('refused') : undefined, mutate }) as never,
    );
    render(<RunChartCard scope={{}} />);

    expect(screen.getByText('Could not load the run chart')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(mutate).toHaveBeenCalled();
  });
});
