import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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

  it('draws the median dashed and without visible points, named briefly with its value', () => {
    render(<RunChartLine name="Retained" points={days(12)} median={30} shifts={[]} period="day" kind="count" />);

    const symbols = screen.getAllByRole('graphics-symbol');
    const medianLine = symbols.find(
      (symbol) =>
        symbol.getAttribute('aria-roledescription') === 'line' &&
        symbol.getAttribute('aria-label') === '30,30,30,30,30,30,30,30,30,30,30,30',
    );
    const medianClass = Array.from(medianLine!.classList).find((name) => name.startsWith('stroke-'));
    const sheet = readFileSync(resolve(process.cwd(), 'src/run-charts/run-charts.scss'), 'utf8');
    expect(sheet).toMatch(new RegExp(`path\\.line\\.${medianClass}\\)\\s*\\{[^}]*stroke-dasharray`));
    expect(sheet).toMatch(new RegExp(`circle\\.dot\\.${medianClass}\\)\\s*\\{[^}]*opacity: 0`));
    expect(within(screen.getByRole('group', { name: 'Data groups' })).getByText('Median 30')).toBeInTheDocument();
  });

  it('keeps the median dashed when the median changes while the chart stays mounted', () => {
    const { rerender } = render(
      <RunChartLine name="Retained" points={days(12)} median={30} shifts={[]} period="day" kind="count" />,
    );
    rerender(<RunChartLine name="Retained" points={days(13)} median={31} shifts={[]} period="day" kind="count" />);

    const medianLine = screen
      .getAllByRole('graphics-symbol')
      .find(
        (symbol) =>
          symbol.getAttribute('aria-roledescription') === 'line' &&
          symbol.getAttribute('aria-label') === Array(13).fill(31).join(','),
      );
    expect(medianLine).toHaveClass('stroke-2-1-2');
  });
});
