import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';
import { periods } from './period';

const today = dayjs('2026-10-07');

describe('periods', () => {
  it('offers this month and the eleven before it, each from its first to its last day', () => {
    const months = periods('month', today);

    expect(months).toHaveLength(12);
    expect(months[0]).toMatchObject({ key: '2026-10-01', label: 'Oct 2026' });
    expect(months[0].end.format('YYYY-MM-DD')).toBe('2026-10-31');
    expect(months[11]).toMatchObject({ key: '2025-11-01', label: 'Nov 2025' });
  });

  it('offers this quarter and the three before it', () => {
    const quarters = periods('quarter', today);

    expect(quarters.map(({ label }) => label)).toEqual(['Q4 2026', 'Q3 2026', 'Q2 2026', 'Q1 2026']);
    expect(quarters[1].start.format('YYYY-MM-DD')).toBe('2026-07-01');
    expect(quarters[1].end.format('YYYY-MM-DD')).toBe('2026-09-30');
  });
});
