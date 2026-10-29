import React from 'react';
import { useTranslation } from 'react-i18next';
import { InlineNotification } from '@carbon/react';
import { formatDate } from '@openmrs/esm-framework';
import { kindOf, periodName, periodNames, type RunChartPeriod } from './run-chart-metrics';
import { localDay, MIN_POINTS_FOR_MEDIAN, type RunChartPoint, withValue } from './run-chart-stats';
import { pointDetail } from './run-chart-tooltip';
import styles from './run-charts.scss';

/** Before a chart can be drawn: that nothing was counted in the range, or the one figure there is. */
export function HistoryNotice({
  points,
  period,
  metric,
  clinic,
}: {
  points: Array<RunChartPoint>;
  period: RunChartPeriod;
  metric: string;
  clinic: string;
}) {
  const { t } = useTranslation();
  const held = withValue(points);
  if (!held.length) {
    return (
      <InlineNotification
        kind="info"
        lowContrast
        hideCloseButton
        title={t('runChartNothingToChart', 'Nothing to chart for {{clinic}} in this range', { clinic })}
        subtitle={t('runChartNothingToChartDetail', 'Points appear once the clinic has registrants in the range.')}
      />
    );
  }
  const latest = held[held.length - 1];
  return (
    <div className={styles.history}>
      <InlineNotification
        kind="info"
        lowContrast
        hideCloseButton
        title={t('runChartOnePoint', 'One point has a value in this range')}
        subtitle={t(
          'runChartChartAppears',
          'The chart appears after the second {{unit}}; a median and shifts after {{count}} {{units}}.',
          {
            unit: periodName(t, period),
            count: MIN_POINTS_FOR_MEDIAN,
            units: periodNames(t, period),
          },
        )}
      />
      <p>
        {t('runChartLatest', 'Latest, {{date}}: {{detail}}', {
          date: formatDate(localDay(latest.date), { time: false, noToday: true }),
          detail: pointDetail(t, kindOf(metric), latest),
        })}
      </p>
    </div>
  );
}
