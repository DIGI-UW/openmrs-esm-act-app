import { type TFunction } from 'i18next';
import { formatDate } from '@openmrs/esm-framework';
import { type RunChartMetricKind, type RunChartPeriod, periodName } from './run-chart-metrics';
import { localDay, type RunChartPoint } from './run-chart-stats';

/** What a point is called in its tooltip's first line: a night, or the week or month that starts on its date. */
export function pointTitle(t: TFunction, period: RunChartPeriod, date: string) {
  const day = formatDate(localDay(date), { time: false, noToday: true });
  if (period === 'week') {
    return t('weekOf', 'Week of {{date}}', { date: day });
  }
  if (period === 'month') {
    return t('monthOf', 'Month of {{date}}', { date: day });
  }
  return day;
}

/**
 * A point's value and the figures behind it. A week or month percent is a ratio of sums over the period's days, so
 * its counts are patient-days; a week or month count is the last snapshot of the period.
 */
export function pointDetail(t: TFunction, period: RunChartPeriod, kind: RunChartMetricKind, point: RunChartPoint) {
  if (point.value === null) {
    return t('runChartNoValue', 'No value: nobody to count');
  }
  if (kind === 'count') {
    return period === 'day'
      ? String(point.value)
      : t('runChartCountLast', '{{value}} · last snapshot of the {{period}}', {
          value: point.value,
          period: periodName(t, period),
        });
  }
  const figures = { value: point.value, count: point.count, total: point.total };
  return period === 'day'
    ? t('runChartPercentOfDay', '{{value}}% · {{count}} of {{total}}', figures)
    : t('runChartPercentOfPeriod', '{{value}}% · {{count}} of {{total}} patient-days', figures);
}
