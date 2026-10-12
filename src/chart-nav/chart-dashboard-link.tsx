import React, { useMemo } from 'react';
import { createDashboard } from '@openmrs/esm-framework';

interface ChartDashboardLinkProps {
  basePath: string;
  slot: string;
  path: string;
  title: string;
  icon: string;
}

/** The chart's left nav link to one of its pages, as createDashboard draws it, for a link shown only to some patients. */
export function ChartDashboardLink({ basePath, ...meta }: ChartDashboardLinkProps) {
  const { slot, path, title, icon } = meta;
  const Link = useMemo(() => createDashboard({ slot, path, title, icon }), [slot, path, title, icon]);
  return <Link basePath={basePath} />;
}
