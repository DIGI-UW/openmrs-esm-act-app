import React from 'react';
import { useTranslation } from 'react-i18next';
import { InlineNotification, SkeletonText } from '@carbon/react';
import { formatDate } from '@openmrs/esm-framework';
import { kindOf, periodName, periodNames } from './run-chart-metrics';
import { localDay, MIN_POINTS_FOR_MEDIAN, withValue } from './run-chart-stats';
import { pointDetail } from './run-chart-tooltip';
import { type RunChartParams, useRunChart } from './run-chart.resource';
import styles from './run-charts.scss';

// The range chosen says nothing of when snapshots started, so the days are asked for from long before.
const earliestDay = '2000-01-01';

/** Before a chart can be drawn: when the snapshots started and the latest figure, both from the nightly points. */
export function HistoryNotice({ params, clinic }: { params: RunChartParams; clinic: string }) {
  const { t } = useTranslation();
  const days = useRunChart({ ...params, startDate: earliestDay, points: 'day' });
  if (days.isLoading) {
    return <SkeletonText paragraph lineCount={2} />;
  }
  const held = withValue(days.points);
  if (!held.length) {
    return (
      <InlineNotification
        kind="info"
        lowContrast
        hideCloseButton
        title={t('runChartNoHistory', 'No snapshot has been taken for {{clinic}} yet', { clinic })}
        subtitle={t('runChartHistoryStartsFirstNight', 'History starts the first night the snapshot runs.')}
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
        title={t('runChartHistoryStarted', 'Snapshots started on {{date}}', {
          date: formatDate(localDay(held[0].date), { time: false, noToday: true }),
        })}
        subtitle={t(
          'runChartChartAppears',
          'The chart appears after the second {{unit}}; a median and shifts after {{count}} {{units}}.',
          {
            unit: periodName(t, params.points),
            count: MIN_POINTS_FOR_MEDIAN,
            units: periodNames(t, params.points),
          },
        )}
      />
      <p>
        {t('runChartLatest', 'Latest, {{date}}: {{detail}}', {
          date: formatDate(localDay(latest.date), { time: false, noToday: true }),
          detail: pointDetail(t, 'day', kindOf(params.metric), latest),
        })}
      </p>
    </div>
  );
}
