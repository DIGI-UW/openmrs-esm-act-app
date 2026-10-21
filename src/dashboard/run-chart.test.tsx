import React from 'react';
import dayjs from 'dayjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import { openmrsFetch } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import RunChartSection from './run-chart.component';

vi.mock('@carbon/charts-react/styles.css', () => ({}));
vi.mock('@carbon/charts-react', () => ({
  LineChart: ({ data }: { data: Array<{ group: string; date: string; value: number }> }) => (
    <ul data-testid="line">
      {data.map((d) => (
        <li key={d.date}>{`${d.group}|${d.date}|${d.value}`}</li>
      ))}
    </ul>
  ),
  ScaleTypes: { TIME: 'time' },
}));

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

function backendAnswers(points: Array<{ date: string; value: number | null }>, lastSnapshot: string | null = null) {
  mockOpenmrsFetch.mockImplementation((async (url: string) => ({
    data: { metric: new URL(url, 'http://x').searchParams.get('metric'), points, lastSnapshot },
  })) as never);
}

const lastUrl = () => new URL(mockOpenmrsFetch.mock.calls.at(-1)[0] as string, 'http://x');

function renderSection(scope: Record<string, string> = { cardiacClinic: 'gulu' }) {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <RunChartSection scope={scope} />
    </SWRConfig>,
  );
}

describe('Run charts', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await signInWith(['App: act.reports']);
  });

  it("charts the first metric over the year to today, of the dashboard's clinic", async () => {
    backendAnswers([{ date: '2026-10-20', value: 12 }], '2026-10-20');

    renderSection();

    expect(await screen.findByText('Total registrants|2026-10-20T00:00:00|12')).toBeInTheDocument();
    const url = lastUrl();
    expect(url.pathname).toMatch(/\/ws\/rest\/v1\/actcore\/runchart$/);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      metric: 'total_registrants',
      startDate: dayjs().subtract(1, 'year').format('YYYY-MM-DD'),
      endDate: dayjs().format('YYYY-MM-DD'),
      clinic: 'gulu',
    });
  });

  it('reads the metric chosen, of every clinic when none is chosen, leaving out days of no percent', async () => {
    backendAnswers([
      { date: '2026-10-19', value: null },
      { date: '2026-10-20', value: 40.5 },
    ]);
    renderSection({});

    await userEvent.selectOptions(
      await screen.findByRole('combobox', { name: 'Display metric' }),
      'active_registrants_adherent',
    );

    expect(
      await screen.findByText('Percent of active registrants adherent 80% or more|2026-10-20T00:00:00|40.5'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/2026-10-19/)).not.toBeInTheDocument();
    expect(lastUrl().searchParams.get('metric')).toBe('active_registrants_adherent');
    expect(lastUrl().searchParams.has('clinic')).toBe(false);
  });

  it('follows the primary care clinic when no cardiac clinic is chosen', async () => {
    backendAnswers([]);

    renderSection({ primaryCareClinic: 'akunalaber' });

    expect(await screen.findByText('No snapshot was taken in this period')).toBeInTheDocument();
    expect(lastUrl().searchParams.get('clinic')).toBe('akunalaber');
    expect(screen.getByText('Snapshots are taken daily; none has been taken yet')).toBeInTheDocument();
  });

  it('says it follows the cardiac clinic when both clinics are chosen', async () => {
    backendAnswers([]);

    renderSection({ cardiacClinic: 'gulu', primaryCareClinic: 'akunalaber' });

    expect(
      await screen.findByText('Run charts are kept per clinic, so they show the cardiac clinic chosen'),
    ).toBeInTheDocument();
    expect(lastUrl().searchParams.get('clinic')).toBe('gulu');
  });

  it('says so when the run chart cannot be loaded', async () => {
    mockOpenmrsFetch.mockRejectedValue(new Error('boom'));

    renderSection();

    expect(await screen.findByText('Could not load Run charts')).toBeInTheDocument();
  });
});
