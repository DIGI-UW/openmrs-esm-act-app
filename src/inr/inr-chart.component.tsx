import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../format-date';
import { standardTarget } from './inr.resource';

export interface InrPoint {
  date: Date;
  value: number;
  target: [number, number] | null;
}

type Tone = 'green' | 'orange' | 'red';

/** ACT 2.0's reading of an INR: green inside the target, orange outside it, red below 1.5 or above 4.0. */
export function inrTone(value: number, target: [number, number] | null): Tone {
  const [low, high] = target ?? standardTarget;
  if (value >= low && value <= high) {
    return 'green';
  }
  return value < 1.5 || value > 4 ? 'red' : 'orange';
}

const fills: Record<Tone, string> = { green: '#24a148', orange: '#ff832b', red: '#da1e28' };
const zoneBands: Array<[Tone, number, number]> = [
  ['orange', 3, 4],
  ['green', 2, 3],
  ['orange', 1.5, 2],
  ['red', 0, 1.5],
];
const minWidth = 760;
const plotAt = (width: number) => ({ left: 40, right: width - 10, top: 22, bottom: 160, inset: 40 });
const height = 190;
const maxDateLabels = 8;
const minLabelGap = 70;

/** The chart's geometry: ACT 2.0's zones on a 0 to 5 axis, one dot per reading by date, and the patient's own target. */
export function inrChartModel(points: Array<InrPoint>, width = minWidth) {
  const plot = plotAt(width);
  const sorted = [...points].sort((a, b) => a.date.getTime() - b.date.getTime());
  const top = Math.max(5, Math.ceil(Math.max(...sorted.map((point) => point.value))));
  const y = (value: number) => plot.bottom - (value / top) * (plot.bottom - plot.top);
  const zones = [['red', 4, top] as [Tone, number, number], ...zoneBands].map(([tone, from, to]) => ({
    tone,
    from,
    to,
    y: y(to),
    height: y(from) - y(to),
  }));
  const first = sorted[0]?.date.getTime() ?? 0;
  const span = (sorted.at(-1)?.date.getTime() ?? 0) - first;
  const x = (date: Date) =>
    span === 0
      ? (plot.left + plot.right) / 2
      : plot.left + plot.inset + ((date.getTime() - first) / span) * (plot.right - plot.left - 2 * plot.inset);
  const dots = sorted.map((point) => ({ ...point, x: x(point.date), y: y(point.value) }));
  const own = [...sorted].reverse().find((point) => point.target)?.target ?? null;
  const differs = own && (own[0] !== standardTarget[0] || own[1] !== standardTarget[1]);
  const targetBox = differs ? { low: own[0], high: own[1], y: y(own[1]), height: y(own[0]) - y(own[1]) } : null;
  const latest = dots.at(-1);
  const valueLabel = latest ? { value: latest.value, x: latest.x, y: latest.y - 10 } : null;
  return { top, y, zones, dots, targetBox, valueLabel, dateLabels: thinned(dots.map((dot) => dot.x)) };
}

/** The width the chart fills, at least what its labels need. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(minWidth);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(minWidth, Math.floor(entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

/** The indexes of the dates to label: the first, the last and an even spread, dropping one within a label's width of the one before. */
function thinned(xs: Array<number>) {
  const count = Math.min(xs.length, maxDateLabels);
  const picks = Array.from({ length: count }, (_, k) =>
    count === 1 ? 0 : Math.round((k * (xs.length - 1)) / (count - 1)),
  );
  const kept: Array<number> = [];
  const clashes = (index: number) => kept.length > 0 && xs[index] - xs[kept[kept.length - 1]] < minLabelGap;
  picks.forEach((index, k) => {
    while (k === picks.length - 1 && clashes(index)) {
      kept.pop();
    }
    if (!clashes(index)) {
      kept.push(index);
    }
  });
  return kept;
}

const range = (low: number, high: number) => `${low.toFixed(1)}-${high.toFixed(1)}`;

/**
 * The INR over time as ACT 2.0 draws it: a black line on its green, orange and red zones, with the target the
 * patient's own INR Monitoring records marked when it is not 2.0 to 3.0.
 */
export default function InrChart({ readings }: { readings: Array<InrPoint> }) {
  const { t } = useTranslation();
  const { ref, width } = useWidth();
  const plot = plotAt(width);
  const { top, y, zones, dots, targetBox, valueLabel, dateLabels } = inrChartModel(readings, width);
  const day = (date: Date) => formatDate(date, { time: false, noToday: true });
  const reading = (dot: { value: number; date: Date }) =>
    t('inrReadingOn', '{{value}} on {{date}}', { value: dot.value, date: day(dot.date) });
  const description = t(
    'inrChartDescription',
    'INR over time: {{readings}}. Green zone 2.0 to 3.0, orange 1.5 to 2.0 and 3.0 to 4.0, red below 1.5 and above 4.0.',
    {
      readings: dots.map(reading).join(', '),
    },
  );
  return (
    <div ref={ref} style={{ overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: `${width}px`, height: 'auto' }}
        role="img"
        aria-label={description}
      >
        {zones.map((zone) => (
          <rect
            key={`${zone.tone}-${zone.from}`}
            x={plot.left}
            y={zone.y}
            width={plot.right - plot.left}
            height={zone.height}
            fill={fills[zone.tone]}
            fillOpacity={zone.tone === 'red' ? 0.14 : 0.2}
            data-tone={zone.tone}
          />
        ))}
        <line x1={plot.left} y1={plot.bottom} x2={plot.right} y2={plot.bottom} stroke="#8d8d8d" />
        {Array.from({ length: top + 1 }, (_, value) => (
          <text key={value} x="8" y={y(value) + 4} fontSize="11" fill="#525252">
            {value}
          </text>
        ))}
        {targetBox ? (
          <>
            <rect
              x={plot.left}
              y={targetBox.y}
              width={plot.right - plot.left}
              height={targetBox.height}
              fill="none"
              stroke="#161616"
              strokeDasharray="5 3"
            />
            <text x={plot.right - 4} y={targetBox.y - 4} fontSize="11" fill="#161616" textAnchor="end">
              {t('inrChartTarget', 'Target {{range}}', { range: range(targetBox.low, targetBox.high) })}
            </text>
          </>
        ) : (
          <text x={plot.right - 4} y={y(2.5) + 4} fontSize="11" fill="#0e6027" textAnchor="end">
            {t('inrChartTarget', 'Target {{range}}', { range: range(...standardTarget) })}
          </text>
        )}
        <polyline
          points={dots.map((dot) => `${dot.x},${dot.y}`).join(' ')}
          fill="none"
          stroke="#161616"
          strokeWidth="2"
        />
        {dots.map((dot, index) => (
          <circle key={index} cx={dot.x} cy={dot.y} r="4" fill="#161616" data-testid="inr-dot" />
        ))}
        {dateLabels.map((index) => (
          <text
            key={index}
            x={dots[index].x}
            y={plot.bottom + 20}
            fontSize="11"
            fill="#525252"
            textAnchor="middle"
            data-testid="inr-date-label"
          >
            {day(dots[index].date)}
          </text>
        ))}
        {valueLabel ? (
          <text x={valueLabel.x} y={valueLabel.y} fontSize="11" fontWeight="600" fill="#161616" textAnchor="middle">
            {valueLabel.value}
          </text>
        ) : null}
      </svg>
    </div>
  );
}
