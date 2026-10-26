import React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { RunChartLine } from './run-chart-line.component';
import { type RunChartPoint, type Shift } from './run-chart-stats';

const days = (count: number): Array<RunChartPoint> =>
  Array.from({ length: count }, (_, index) => ({
    date: `2026-03-${String(index + 1).padStart(2, '0')}`,
    value: 20 + index,
    count: 20 + index,
    total: null,
  }));
const below: Shift = { start: '2026-03-01', end: '2026-03-08', side: 'below', length: 8 };

describe('RunChartLine drawn by Carbon', () => {
  beforeAll(() => {
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  it('draws a shift band without throwing, as Carbon reads its colour by label', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      render(<RunChartLine name="Retained" points={days(12)} median={30} shifts={[below]} period="day" kind="count" />),
    ).not.toThrow();
    errors.mockRestore();
  });
});
