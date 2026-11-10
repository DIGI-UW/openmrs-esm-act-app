import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { LineChart } from '@carbon/charts-react';
import { RunChartLine } from './run-chart-line.component';

vi.mock('@carbon/charts-react', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  LineChart: vi.fn(() => null),
}));

describe("RunChartLine's axis dates", () => {
  it('labels a September tick Sep in an en-GB browser, as the rest of ACT writes it', () => {
    render(
      <RunChartLine
        name="Retained"
        points={[{ date: '2026-09-01', value: 20, count: 20, total: null }]}
        median={20}
        shifts={[]}
        period="month"
        kind="count"
      />,
    );

    const { options } = vi.mocked(LineChart).mock.lastCall[0] as {
      options: {
        locale: {
          date: (value: Date, language: string, options: Intl.DateTimeFormatOptions, preformatted?: string) => string;
        };
      };
    };
    expect(options.locale.date(new Date(2026, 8, 1), 'en-GB', { month: 'short', year: 'numeric' })).toBe('Sep 2026');
    expect(options.locale.date(new Date(2026, 8, 1), 'en-GB', { month: 'short', day: 'numeric' })).toBe('1 Sep');
    expect(options.locale.date(new Date(2026, 10, 1), 'en-GB', { month: 'short', year: 'numeric' })).toBe('Nov 2026');
    expect(options.locale.date(new Date(2026, 6, 1), 'en-GB', {}, 'Q3 2026')).toBe('Q3 2026');
  });
});
