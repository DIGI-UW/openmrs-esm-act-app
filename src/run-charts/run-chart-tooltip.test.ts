import { describe, expect, it } from 'vitest';
import { formatDate } from '@openmrs/esm-framework';
import { pointDetail, pointTitle } from './run-chart-tooltip';

// The plain mock answers a key's English default, or the key itself when it has none.
const t = ((key: string, defaults?: unknown, values?: Record<string, unknown>) =>
  Object.entries(values ?? {}).reduce(
    (text, [name, value]) => text.replace(`{{${name}}}`, String(value)),
    typeof defaults === 'string' ? defaults : key,
  )) as never;

const percent = { date: '2026-10-19', value: 85.7, count: 354, total: 413 };

describe('pointDetail', () => {
  it('gives a day percent with its counts', () => {
    expect(pointDetail(t, 'day', 'percent', percent)).toBe('85.7% · 354 of 413');
  });

  it('labels a week or month percent as patient-days, as its counts are sums over the days', () => {
    expect(pointDetail(t, 'week', 'percent', percent)).toBe('85.7% · 354 of 413 patient-days');
    expect(pointDetail(t, 'month', 'percent', percent)).toBe('85.7% · 354 of 413 patient-days');
  });

  it('gives a day count as it is, and a week or month count as the last snapshot of the period', () => {
    const count = { date: '2026-10-19', value: 412, count: 412, total: null };
    expect(pointDetail(t, 'day', 'count', count)).toBe('412');
    expect(pointDetail(t, 'week', 'count', count)).toBe('412 · last snapshot of the week');
    expect(pointDetail(t, 'month', 'count', count)).toBe('412 · last snapshot of the month');
  });

  it('says there is no value for a percent of nobody', () => {
    expect(pointDetail(t, 'week', 'percent', { date: '2026-10-19', value: null, count: 0, total: 0 })).toBe(
      'No value: nobody to count',
    );
  });
});

describe('pointTitle', () => {
  it('names the week or month by its first day, and a night by its date, as the same local day', () => {
    const day = formatDate(new Date(2026, 9, 19), { time: false, noToday: true });
    expect(pointTitle(t, 'week', '2026-10-19')).toBe(`Week of ${day}`);
    expect(pointTitle(t, 'month', '2026-10-19')).toBe(`Month of ${day}`);
    expect(pointTitle(t, 'day', '2026-10-19')).toBe(day);
  });
});
