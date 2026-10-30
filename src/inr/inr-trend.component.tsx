import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AreaChart, ScaleTypes } from '@carbon/charts-react';
import '@carbon/charts-react/styles.css';
import { Button, InlineNotification, SkeletonText } from '@carbon/react';
import { useConfig, userHasAccess, useSession } from '@openmrs/esm-framework';
import { useStable } from '../run-charts/run-chart-line.component';
import { useMayEnterForm } from '../access/may-enter-form';
import { type Config } from '../config-schema';
import { PRIVILEGE_EDIT_ENCOUNTERS } from '../constants';
import { useChartEncounters } from '../consultations/consultations.resource';
import InrEditPanel from './inr-edit-panel.component';
import { latestInrEntry } from './inr-edit.resource';
import { targetRange, useInrReviews, type InrReview } from './inr.resource';

/** The therapeutic range for a patient none of whose INRs records a target: ACT 2.0's green band. */
export const standardTarget: [number, number] = [2, 3];

/**
 * One point per INR value, oldest first, each with the band its INR Monitoring's target gives, else the nearest
 * known one, else the standard range.
 */
export function inrChartData(reviews: Array<InrReview>, label: string) {
  const oldestFirst = [...reviews].reverse().filter((review) => Number.isFinite(review.inr));
  const firstTarget = oldestFirst.map((review) => targetRange(review.target)).find(Boolean) ?? standardTarget;
  let band = firstTarget;
  return oldestFirst.map((review) => {
    band = targetRange(review.target) ?? band;
    return { group: label, date: review.date, value: review.inr as number, low: band[0], high: band[1] };
  });
}

/**
 * The consultation form's INR over time, with the target range as its band: for a patient on warfarin or with an INR
 * on record, and nothing for any other.
 */
export default function InrTrend({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const { reviews, onWarfarin, isLoading, error } = useInrReviews(patientUuid);
  const { inrReviews } = useConfig<Config>();
  const { encounters } = useChartEncounters(patientUuid, inrReviews.encounterType);
  const { user } = useSession();
  const mayRecord = useMayEnterForm(inrReviews.form);
  const mayEdit = mayRecord && Boolean(user) && userHasAccess(PRIVILEGE_EDIT_ENCOUNTERS, user);
  const entry = latestInrEntry(encounters, inrReviews.concepts);
  const [panel, setPanel] = useState<'edit' | 'record' | null>(null);
  const label = t('inrChartValue', 'INR');
  const data = useStable(inrChartData(reviews, label));
  const top = Math.max(5, Math.ceil(Math.max(...data.map((point) => Math.max(point.value, point.high)))));
  const options = useStable({
    title: t('inrChartTitle', 'INR over time, with the target range'),
    height: '260px',
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
        title={t('inrChartError', 'The INR could not be loaded')}
      />
    );
  }
  const actions = panel ? (
    <InrEditPanel patientUuid={patientUuid} entry={entry} mode={panel} onClose={() => setPanel(null)} />
  ) : (
    <div>
      {entry && mayEdit && (
        <Button type="button" kind="tertiary" size="sm" onClick={() => setPanel('edit')}>
          {t('editInrMonitoring', 'Edit INR monitoring')}
        </Button>
      )}
      {entry?.group && mayRecord && (
        <Button type="button" kind="ghost" size="sm" onClick={() => setPanel('record')}>
          {t('recordNewInr', 'Record new INR')}
        </Button>
      )}
      {!entry && mayRecord && (
        <Button type="button" kind="tertiary" size="sm" onClick={() => setPanel('record')}>
          {t('recordInrMonitoring', 'Record INR monitoring')}
        </Button>
      )}
    </div>
  );
  if (!data.length) {
    return onWarfarin ? (
      <div>
        <p>{t('inrChartEmpty', 'No INR recorded')}</p>
        {actions}
      </div>
    ) : null;
  }
  return (
    <div data-testid="inr-chart">
      <AreaChart data={data} options={options} />
      {actions}
    </div>
  );
}
