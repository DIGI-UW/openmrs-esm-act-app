import React from 'react';
import { useTranslation } from 'react-i18next';
import { useConfig } from '@openmrs/esm-framework';
import { ChartTableCard, type ChartTableColumn } from '../chart-pages/chart-table-card.component';
import { type Config } from '../config-schema';
import { day } from '../patient-encounters';
import { type InrResult, type InrReview, useInrReviews } from './inr.resource';

export function useResultLabel() {
  const { t } = useTranslation();
  return (result: InrResult) =>
    ({
      inRange: t('inRange', 'In range'),
      below: t('belowRange', 'Below range'),
      above: t('aboveRange', 'Above range'),
    })[result] ?? '--';
}

/** The chart's INR reviews: each reading, newest first, and Record INR for whoever may record one. */
export default function InrReviews({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const { inr: config } = useConfig<Config>();
  const { reviews, error, isLoading } = useInrReviews(patientUuid);
  const resultLabel = useResultLabel();
  const columns: Array<ChartTableColumn<InrReview>> = [
    { header: t('date', 'Date'), text: (review) => day(review.date) ?? '--' },
    { header: t('inr', 'INR'), text: (review) => (review.inr == null ? '--' : String(review.inr)) },
    { header: t('targetRange', 'Target range'), text: (review) => review.target ?? '--' },
    { header: t('result', 'Result'), text: (review) => resultLabel(review.result) },
    { header: t('nextInr', 'Next INR'), text: (review) => day(review.nextInr) ?? '--' },
  ];
  return (
    <ChartTableCard
      patientUuid={patientUuid}
      title={t('inrReviews', 'INR reviews')}
      rowsName={t('inrReviewsLowercase', 'INR reviews')}
      form={config.form}
      actionLabel={t('recordInr', 'Record INR')}
      columns={columns}
      rows={reviews}
      rowKey={(review) => review.key}
      isLoading={isLoading}
      error={error}
    />
  );
}
