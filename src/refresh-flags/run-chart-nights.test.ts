import { describe, expect, it } from 'vitest';
import { nightsOf } from './run-chart-nights';
import { type RunChartRun } from './run-chart-snapshot.resource';

const run = (runDate: string, finished: string, status: RunChartRun['status'] = 'taken'): RunChartRun => ({
  runDate,
  finished,
  durationMillis: 1000,
  source: 'scheduled',
  status,
  rows: status === 'taken' ? 61 : 0,
  clinics: status === 'taken' ? 60 : 0,
  reason: status === 'failed' ? 'no report' : null,
});

describe('nightsOf', () => {
  const today = new Date(2026, 9, 21);

  it('lists seven nights up to today, newest first, each with its run', () => {
    const nights = nightsOf(
      [run('2026-10-21', '2026-10-21T02:05:00Z'), run('2026-10-19', '2026-10-19T02:05:00Z')],
      today,
    );

    expect(nights.map((night) => night.date)).toEqual([
      '2026-10-21',
      '2026-10-20',
      '2026-10-19',
      '2026-10-18',
      '2026-10-17',
      '2026-10-16',
      '2026-10-15',
    ]);
    expect(nights.map((night) => night.run?.runDate ?? null)).toEqual([
      '2026-10-21',
      null,
      '2026-10-19',
      null,
      null,
      null,
      null,
    ]);
  });

  it('lists a night on which nothing ran, with no run, rather than leaving it out', () => {
    expect(nightsOf([], today).every((night) => night.run === null)).toBe(true);
  });

  it('shows a night by its latest taken run when a snapshot was taken again that day', () => {
    const failed = run('2026-10-21', '2026-10-21T02:05:00Z', 'failed');
    const again = { ...run('2026-10-21', '2026-10-21T09:40:00Z'), source: 'manual' as const };

    expect(nightsOf([again, failed], today)[0].run).toBe(again);
    expect(nightsOf([failed, again], today)[0].run).toBe(again);
  });

  it('keeps a night taken when a later run that day failed, since the failed run kept the rows', () => {
    const taken = run('2026-10-21', '2026-10-21T02:05:00Z');
    const failed = { ...run('2026-10-21', '2026-10-21T09:40:00Z', 'failed'), source: 'manual' as const };

    expect(nightsOf([failed, taken], today)[0].run).toBe(taken);
    expect(nightsOf([taken, failed], today)[0].run).toBe(taken);
  });

  it('shows a night by its latest failed run when none was taken', () => {
    const early = run('2026-10-21', '2026-10-21T02:05:00Z', 'failed');
    const late = run('2026-10-21', '2026-10-21T09:40:00Z', 'failed');

    expect(nightsOf([early, late], today)[0].run).toBe(late);
  });

  it('marks only today as the night in progress', () => {
    expect(nightsOf([], today).map((night) => night.today)).toEqual([true, false, false, false, false, false, false]);
  });

  it('leaves out runs older than the nights listed', () => {
    expect(nightsOf([run('2026-10-01', '2026-10-01T02:05:00Z')], today).every((night) => night.run === null)).toBe(
      true,
    );
  });
});
