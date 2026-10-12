import React from 'react';
import { usePatient } from '@openmrs/esm-framework';
import { ChartDashboardLink } from '../chart-nav/chart-dashboard-link';
import { useConsultationSummary } from '../consultations/consultations.resource';
import { inrReviewsDashboardMeta } from './inr-reviews.meta';

/** The chart's INR reviews link, for a patient on warfarin only. */
export default function InrReviewsDashboardLink({ basePath }: { basePath: string }) {
  const { patientUuid } = usePatient();
  const { onWarfarin } = useConsultationSummary(patientUuid ?? null);
  return onWarfarin ? <ChartDashboardLink basePath={basePath} {...inrReviewsDashboardMeta} /> : null;
}
