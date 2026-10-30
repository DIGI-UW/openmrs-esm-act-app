import { type TFunction } from 'i18next';
import { formatDate } from '@openmrs/esm-framework';
import { type RunChartMetricKind, type RunChartPeriod } from './run-chart-metrics';
import { localDay, type RunChartPoint } from './run-chart-stats';

/** What a point is called in its tooltip's first line: its day, or the week or month that ends on it. */
export function pointTitle(t: TFunction, period: RunChartPeriod, date: string) {
  const day = formatDate(localDay(date), { time: false, noToday: true });
  if (period === 'week') {
    return t('weekTo', 'Week to {{date}}', { date: day });
  }
  if (period === 'month') {
    return t('monthTo', 'Month to {{date}}', { date: day });
  }
  return day;
}

/** A point's value and, for a percent, the figures behind it on its day. */
export function pointDetail(t: TFunction, kind: RunChartMetricKind, point: RunChartPoint) {
  if (point.value === null) {
    return t('runChartNoValue', 'No value: nobody to count');
  }
  if (kind === 'count') {
    return String(point.value);
  }
  const figures = { value: point.value, count: point.count, total: point.total };
  return t('runChartPercentOf', '{{value}}% · {{count}} of {{total}}', figures);
}
