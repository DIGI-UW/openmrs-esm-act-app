import React from 'react';
import { ExtensionSlot } from '@openmrs/esm-framework';
import { patientOfBasePath } from './inr-dashboard-link.component';

/** The slot the INR trend extension attaches to, which this control hosts inside the consultation form. */
export const inrTrendSlot = 'act-consultation-inr-slot';

/**
 * What the form engine renders for a `control` question whose rendering is `act-inr-chart`. The engine hands a control
 * no patient, so this reads the chart's from the page and shows nothing without one; nothing here is submitted.
 */
export default function InrChartControl() {
  const patientUuid = patientOfBasePath(window.location.pathname);
  return patientUuid ? <ExtensionSlot name={inrTrendSlot} state={{ patientUuid }} /> : null;
}
