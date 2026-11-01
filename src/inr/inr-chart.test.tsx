import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import InrChart, { inrChartModel, inrTone, type InrPoint } from './inr-chart.component';

const point = (day: string, value: number, target: [number, number] | null = [2, 3]): InrPoint => ({
  date: new Date(`${day}T00:00:00`),
  value,
  target,
});

describe('inrTone', () => {
  it.each([
    [2.4, [2, 3], 'green'],
    [3, [2, 3], 'green'],
    [3.4, [2.5, 3.5], 'green'],
    [3.1, [2, 3], 'orange'],
    [1.7, [2, 3], 'orange'],
    [4, [2, 3], 'orange'],
    [4.2, [2, 3], 'red'],
    [1.4, [2, 3], 'red'],
    [3.1, null, 'orange'],
    [2.4, null, 'green'],
  ] as Array<[number, [number, number] | null, string]>)(
    'is the tone of %s against the target %j: %s',
    (value, target, tone) => {
      expect(inrTone(value, target)).toBe(tone);
    },
  );
});

describe('inrChartModel', () => {
  const points = [point('2026-09-28', 2.2), point('2026-10-05', 2.6), point('2026-10-12', 3.1)];

  it("draws ACT 2.0's zones: green 2 to 3, orange 1.5 to 2 and 3 to 4, red below 1.5 and above 4", () => {
    const { zones, y } = inrChartModel(points);

    expect(zones.map((zone) => [zone.tone, zone.from, zone.to])).toEqual([
      ['red', 4, 5],
      ['orange', 3, 4],
      ['green', 2, 3],
      ['orange', 1.5, 2],
      ['red', 0, 1.5],
    ]);
    const green = zones.find((zone) => zone.tone === 'green')!;
    expect(green.y).toBeCloseTo(y(3));
    expect(green.height).toBeCloseTo(y(2) - y(3));
  });

  it('keeps the axis at 5 and raises it for an INR above 5', () => {
    expect(inrChartModel(points).top).toBe(5);
    expect(inrChartModel([...points, point('2026-10-20', 6.2)]).top).toBe(7);
  });

  it('places the readings oldest to newest by date, and a single reading in the middle', () => {
    const xs = inrChartModel(points).dots.map((dot) => dot.x);

    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    expect(xs[1] - xs[0]).toBeCloseTo(((xs[2] - xs[0]) * 7) / 14);
    const [only] = inrChartModel([point('2026-10-12', 2.6)]).dots;
    expect(only.x).toBe(395);
  });

  it("marks the patient's own target only when it differs from the 2.0 to 3.0 zone", () => {
    expect(inrChartModel(points).targetBox).toBeNull();
    expect(inrChartModel([point('2026-10-05', 3.2, [2.5, 3.5])]).targetBox).toMatchObject({
      low: 2.5,
      high: 3.5,
    });
  });

  it('takes the target from the newest reading that records one', () => {
    const box = inrChartModel([
      point('2026-09-28', 2.2, [2, 3]),
      point('2026-10-05', 3.2, [2.5, 3.5]),
      point('2026-10-12', 3.1, null),
    ]).targetBox;

    expect(box).toMatchObject({ low: 2.5, high: 3.5 });
  });
});

describe('InrChart', () => {
  it('describes the readings and the zones in words, and labels the latest value', () => {
    render(<InrChart readings={[point('2026-09-28', 2.2), point('2026-10-12', 3.1)]} />);

    const chart = screen.getByRole('img');
    expect(chart).toHaveAccessibleName(/2\.2.*3\.1/);
    expect(chart).toHaveAccessibleName(/green zone 2\.0 to 3\.0/i);
    expect(screen.getByText('3.1')).toBeInTheDocument();
  });

  it('draws a single reading as a point and labels the target when it is the patient’s own', () => {
    render(<InrChart readings={[point('2026-10-12', 3.2, [2.5, 3.5])]} />);

    expect(screen.getAllByTestId('inr-dot')).toHaveLength(1);
    expect(screen.getByText(/Target 2\.5-3\.5/)).toBeInTheDocument();
  });
});
