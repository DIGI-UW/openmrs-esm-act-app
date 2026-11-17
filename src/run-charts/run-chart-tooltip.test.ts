import { describe, expect, it } from 'vitest';
import { formatDate } from '@openmrs/esm-framework';
import { pointDetail, pointTitle } from './run-chart-tooltip';

// The plain mock answers a key's English default, or the key itself when it has none.
const t = ((key: string, defaults?: unknown, values?: Record<string, unknown>) =>
  Object.entries(values ?? {}).reduce(
    (text, [name, value]) => text.replace(`{{${name}}}`, String(value)),
    typeof defaults === 'string' ? defaults : key,
  )) as never;

const percent = { date: '2026-10-18', value: 85.7, count: 354, total: 413 };

describe('pointDetail', () => {
  it('gives a percent with the counts behind it on its day, whatever the period', () => {
    expect(pointDetail(t, 'percent', percent)).toBe('85.7% · 354 of 413');
  });

  it('gives a count as it is', () => {
    expect(pointDetail(t, 'count', { date: '2026-10-18', value: 412, count: 412, total: null })).toBe('412');
  });

  it('says there is no value for a percent of nobody', () => {
    expect(pointDetail(t, 'percent', { date: '2026-10-18', value: null, count: 0, total: 0 })).toBe(
      'No value: nobody to count',
    );
  });
});

describe('pointTitle', () => {
  it('names the week or month by the day it ends on, and a day by its date, as the same local day', () => {
    const day = formatDate(new Date(2026, 9, 18), { time: false, noToday: true });
    expect(pointTitle(t, 'week', '2026-10-18')).toBe(`Week to ${day}`);
    expect(pointTitle(t, 'month', '2026-10-18')).toBe(`Month to ${day}`);
    expect(pointTitle(t, 'day', '2026-10-18')).toBe(day);
  });
});
