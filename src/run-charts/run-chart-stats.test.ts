import { describe, expect, it } from 'vitest';
import { changeOf, localDay, type RunChartPoint, shifts } from './run-chart-stats';

const point = (day: number, value: number | null): RunChartPoint => ({
  date: `2026-03-${String(day).padStart(2, '0')}`,
  value,
  count: value,
  total: null,
});

const series = (...values: Array<number | null>) => values.map((value, index) => point(index + 1, value));

describe('shifts', () => {
  it('finds six points in a row above the median', () => {
    expect(shifts(series(1, 9, 9, 9, 9, 9, 9, 1), 5)).toEqual([
      { start: '2026-03-02', end: '2026-03-07', side: 'above', length: 6 },
    ]);
  });

  it('finds six points in a row below the median', () => {
    expect(shifts(series(9, 1, 1, 1, 1, 1, 1, 9), 5)).toEqual([
      { start: '2026-03-02', end: '2026-03-07', side: 'below', length: 6 },
    ]);
  });

  it('does not highlight a run of five', () => {
    expect(shifts(series(1, 9, 9, 9, 9, 9, 1), 5)).toEqual([]);
  });

  it('breaks a run at a point on the other side of the median', () => {
    expect(shifts(series(9, 9, 9, 1, 9, 9, 9), 5)).toEqual([]);
  });

  it('lets a point on the median neither break a run nor count in it', () => {
    // The median point in the middle is skipped, so the six either side of it are one run.
    expect(shifts(series(9, 9, 9, 5, 9, 9, 9), 5)).toEqual([
      { start: '2026-03-01', end: '2026-03-07', side: 'above', length: 6 },
    ]);
    // Counting the median point, the same series would be a run of seven, not six: it is not counted.
    expect(shifts(series(9, 9, 9, 5, 9, 9), 5)).toEqual([]);
  });

  it('skips a point with no value without breaking the run', () => {
    expect(shifts(series(9, 9, 9, null, 9, 9, 9), 5)).toEqual([
      { start: '2026-03-01', end: '2026-03-07', side: 'above', length: 6 },
    ]);
  });

  it('finds each of two shifts, and one that reaches the end', () => {
    expect(shifts(series(9, 9, 9, 9, 9, 9, 1, 1, 1, 1, 1, 1), 5).map(({ side, length }) => [side, length])).toEqual([
      ['above', 6],
      ['below', 6],
    ]);
  });

  it('finds none with no median', () => {
    expect(shifts(series(9, 9, 9, 9, 9, 9), null)).toEqual([]);
  });
});

describe('changeOf', () => {
  it('is the last value less the first, to one decimal', () => {
    expect(changeOf(series(80, 82.5, 86.4))?.difference).toBe(6.4);
    expect(changeOf(series(94, 90))?.difference).toBe(-4);
  });

  it('is zero when nothing changed', () => {
    expect(changeOf(series(7, 9, 7))?.difference).toBe(0);
  });

  it('reads from the first point with a value to the last one, by their dates', () => {
    const change = changeOf(series(null, 60, 70, null));
    expect(change?.difference).toBe(10);
    expect(change?.from.date).toBe('2026-03-02');
    expect(change?.to.date).toBe('2026-03-03');
  });

  it('is null with fewer than two values', () => {
    expect(changeOf(series(null, 60, null))).toBeNull();
    expect(changeOf([])).toBeNull();
  });
});

describe('localDay', () => {
  it('is the same calendar day whatever the zone', () => {
    const day = localDay('2026-10-19');
    expect([day.getFullYear(), day.getMonth(), day.getDate(), day.getHours()]).toEqual([2026, 9, 19, 0]);
  });
});
