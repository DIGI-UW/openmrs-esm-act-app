import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { DashboardExtension, type IconId } from '@openmrs/esm-framework';

export interface ChartDashboardMeta {
  /** The slot the chart renders the page's content in. */
  slot: string;
  path: string;
  title: string;
  icon: IconId;
}

/** A page's entry in the patient chart's left nav, as esm-patient-common-lib's createDashboardLink makes one. */
export function createChartDashboardLink(meta: ChartDashboardMeta) {
  return function ChartDashboardLink({ basePath }: { basePath: string }) {
    return (
      <BrowserRouter>
        <DashboardExtension basePath={basePath} title={meta.title} path={meta.path} icon={meta.icon} />
      </BrowserRouter>
    );
  };
}
