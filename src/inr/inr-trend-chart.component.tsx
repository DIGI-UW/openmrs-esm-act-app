import React from 'react';
import { useTranslation } from 'react-i18next';
import { AreaChart, ScaleTypes } from '@carbon/charts-react';
import '@carbon/charts-react/styles.css';
import { InlineNotification, SkeletonText } from '@carbon/react';
import { formatDate } from '@openmrs/esm-framework';
import { useStable } from '../run-charts/run-chart-line.component';
import { targetRange, useInrReviews, type InrReview } from './inr.resource';
import styles from './inr-trend-chart.scss';

export const standardTarget: [number, number] = [2, 3];

export function inrChartData(reviews: Array<InrReview>, label: string) {
  const oldestFirst = [...reviews].reverse().filter((review) => Number.isFinite(review.inr));
  const firstTarget = oldestFirst.map((review) => targetRange(review.target)).find(Boolean) ?? standardTarget;
  let band = firstTarget;
  return oldestFirst.map((review) => {
    band = targetRange(review.target) ?? band;
    return { group: label, date: review.date, value: review.inr as number, low: band[0], high: band[1] };
  });
}

export default function InrTrendChart({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const { reviews, onWarfarin, isLoading, error } = useInrReviews(patientUuid);
  const label = t('inrChartValue', 'INR');
  const data = useStable(inrChartData(reviews, label));
  const top = Math.max(5, Math.ceil(Math.max(...data.map((point) => Math.max(point.value, point.high)))));
  const options = useStable({
    title: t('inrChartTitle', 'INR over time, with the target range'),
    height: '220px',
    resizable: true,
    toolbar: { enabled: false },
    legend: { enabled: false },
    points: { enabled: true, radius: 3 },
    curve: 'curveLinear',
    bounds: { upperBoundMapsTo: 'high', lowerBoundMapsTo: 'low' },
    color: { scale: { [label]: '#005d5d' } },
    axes: {
      bottom: { mapsTo: 'date', scaleType: ScaleTypes.TIME },
      left: { mapsTo: 'value', scaleType: ScaleTypes.LINEAR, title: label, domain: [0, top] },
    },
  });
  if (isLoading) {
    return <SkeletonText />;
  }
  if (error) {
    return (
      <InlineNotification
        kind="error"
        hideCloseButton
        lowContrast
        title={t('inrLoadError', 'The INR could not be loaded')}
      />
    );
  }
  if (!data.length) {
    return onWarfarin ? <p className={styles.note}>{t('inrChartEmpty', 'No INR recorded')}</p> : null;
  }
  const standardNote = !reviews.some((review) => targetRange(review.target)) && (
    <p className={styles.note}>{t('inrChartStandardRange', 'Standard range 2.0 to 3.0, as no target is recorded')}</p>
  );
  if (data.length === 1) {
    const [only] = data;
    return (
      <div data-testid="inr-single">
        <p>
          {t('inrChartSingle', 'INR {{inr}} on {{date}}, target range {{low}} to {{high}}', {
            inr: only.value,
            date: formatDate(only.date, { time: false, noToday: true }),
            low: only.low.toFixed(1),
            high: only.high.toFixed(1),
          })}
        </p>
        {standardNote}
      </div>
    );
  }
  return (
    <div data-testid="inr-chart">
      <AreaChart data={data} options={options} />
      {standardNote}
    </div>
  );
}
