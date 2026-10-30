import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { LineChart, ScaleTypes } from '@carbon/charts-react';
import '@carbon/charts-react/styles.css';
import { type RunChartMetricKind, type RunChartPeriod } from './run-chart-metrics';
import { localDay, type RunChartPoint, type Shift, withValue } from './run-chart-stats';
import { pointDetail, pointTitle } from './run-chart-tooltip';
import styles from './run-charts.scss';

const teal = '#005d5d';
const purple = '#8a3ffc';
const green = '#a7f0ba';

// Carbon redraws a chart whenever its data or options is a new object.
function useStable<T>(value: T): T {
  const stable = useRef(value);
  if (JSON.stringify(stable.current) !== JSON.stringify(value)) {
    stable.current = value;
  }
  return stable.current;
}

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

/**
 * A metric's points as a line, with the median as a second line and each shift as a band behind it. Carbon's types
 * have no axis highlights, though its renderer reads them, so they are given through a cast.
 */
export function RunChartLine({
  name,
  axisTitle,
  points,
  median,
  shifts,
  period,
  kind,
  height = '360px',
  compact,
}: {
  name: string;
  /** The left axis's title; none on the compact chart. */
  axisTitle?: string;
  points: Array<RunChartPoint>;
  /** Drawn, with the shifts, when it is given. */
  median: number | null;
  shifts: Array<Shift>;
  period: RunChartPeriod;
  kind: RunChartMetricKind;
  height?: string;
  /** No axes labels or legend, as on the Dashboard's card. */
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const valueGroup = t('runChartValue', 'Value');
  const medianGroup = median === null ? null : t('runChartMedianValue', 'Median {{value}}', { value: median });
  const held = withValue(points);

  const data = useStable([
    ...held.map((point) => ({ group: valueGroup, date: localDay(point.date), value: point.value })),
    ...(medianGroup === null
      ? []
      : held.map((point) => ({ group: medianGroup, date: localDay(point.date), value: median }))),
  ]);

  const highlights = shifts.map((shift) => ({
    startHighlight: localDay(shift.start),
    endHighlight: localDay(shift.end),
    label:
      shift.side === 'above'
        ? t('runChartShiftAbove', 'Shift: {{count}} in a row above the median', { count: shift.length })
        : t('runChartShiftBelow', 'Shift: {{count}} in a row below the median', { count: shift.length }),
  }));

  // The options are kept while they serialise alike, and a function does not, so the tooltip reads this.
  const live = useRef({ held, period, kind, t, medianGroup });
  live.current = { held, period, kind, t, medianGroup };

  const options = useStable({
    accessibility: { svgAriaLabel: name },
    height,
    resizable: true,
    toolbar: { enabled: false },
    legend: { enabled: !compact },
    color: { scale: { [valueGroup]: teal, ...(medianGroup ? { [medianGroup]: purple } : {}) } },
    points: { enabled: true, radius: 3 },
    axes: {
      bottom: {
        mapsTo: 'date',
        scaleType: ScaleTypes.TIME,
        visible: !compact,
        ...(highlights.length
          ? {
              highlights: {
                highlightStartMapsTo: 'startHighlight',
                highlightEndMapsTo: 'endHighlight',
                labelMapsTo: 'label',
                // Carbon reads a highlight's colour from a scale by its label.
                color: { scale: Object.fromEntries(highlights.map((highlight) => [highlight.label, green])) },
                data: highlights,
              },
            }
          : {}),
      },
      left: {
        mapsTo: 'value',
        scaleType: ScaleTypes.LINEAR,
        visible: !compact,
        ...(compact || !axisTitle ? {} : { title: axisTitle }),
        // A percent is never above 100, and Carbon's own scale would stretch past it or clip.
        ...(kind === 'percent' ? { domain: [0, 100] } : {}),
      },
    },
    tooltip: {
      customHTML: (items: Array<{ group: string; date: Date; value: number }>) => {
        const { held, period, kind, t, medianGroup } = live.current;
        const item = items[0];
        if (!item) {
          return '';
        }
        if (item.group === medianGroup) {
          return `<div class="${styles.tooltip}">${escapeHtml(t('runChartMedianValue', 'Median {{value}}', { value: item.value }))}</div>`;
        }
        const point = held.find((candidate) => localDay(candidate.date).getTime() === new Date(item.date).getTime());
        if (!point) {
          return '';
        }
        return `<div class="${styles.tooltip}"><strong>${escapeHtml(pointTitle(t, period, point.date))}</strong><br/>${escapeHtml(pointDetail(t, kind, point))}</div>`;
      },
    },
  });

  return (
    <div className={styles.chart} data-testid="run-chart">
      {/* Carbon numbers its data groups as it meets them, and the scss styles the median by that number. */}
      <LineChart key={medianGroup} data={data} options={options as never} />
      <table className={styles.hidden}>
        <caption>{name}</caption>
        <thead>
          <tr>
            <th>{t('runChartPoint', 'Point')}</th>
            <th>{t('runChartValue', 'Value')}</th>
          </tr>
        </thead>
        <tbody>
          {held.map((point) => (
            <tr key={point.date}>
              <th scope="row">{pointTitle(t, period, point.date)}</th>
              <td>{pointDetail(t, kind, point)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {median !== null && (
        <p className={styles.hidden}>{t('runChartMedianValue', 'Median {{value}}', { value: median })}</p>
      )}
    </div>
  );
}
