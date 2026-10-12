import React, { useMemo } from 'react';
import { createDashboard } from '@openmrs/esm-framework';

type ChartDashboardLinkProps = Parameters<typeof createDashboard>[0] & { basePath: string };

/** The chart's left nav link to one of its pages, as createDashboard draws it, for a link shown only to some patients. */
export function ChartDashboardLink({ basePath, path, title, icon }: ChartDashboardLinkProps) {
  const Link = useMemo(() => createDashboard({ path, title, icon }), [path, title, icon]);
  return <Link basePath={basePath} />;
}
