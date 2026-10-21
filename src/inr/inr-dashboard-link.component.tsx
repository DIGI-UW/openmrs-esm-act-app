import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { DashboardExtension } from '@openmrs/esm-framework';
import { useInrReviews } from './inr.resource';
import { inrReviewsDashboardMeta } from './inr-reviews.meta';

/** The patient whose chart the nav belongs to, from the chart's base path (…/patient/{uuid}/chart). */
export const patientOfBasePath = (basePath: string) => /\/patient\/([^/]+)\/chart/.exec(basePath ?? '')?.[1] ?? null;

/** INR reviews in the chart's nav, as the prototype shows it: only for a patient on warfarin. */
export default function InrDashboardLink({ basePath }: { basePath: string }) {
  const { onWarfarin } = useInrReviews(patientOfBasePath(basePath));
  if (!onWarfarin) {
    return null;
  }
  return (
    <BrowserRouter>
      <DashboardExtension basePath={basePath} {...inrReviewsDashboardMeta} />
    </BrowserRouter>
  );
}
