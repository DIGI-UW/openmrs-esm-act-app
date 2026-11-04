import { getAssignedExtensions, useAssignedExtensions, useExtensionStore } from '@openmrs/esm-framework';

/** A chart page's path, found in the chart's nav as ChartReview finds dashboards, or null when it is not there. */
export function useChartPagePath(linkName: string) {
  // Re-renders when a dashboard group's slot fills, which getAssignedExtensions does not subscribe to.
  useExtensionStore();
  const page = useAssignedExtensions('patient-chart-dashboard-slot')
    .flatMap((link) => (link.config?.slotName ? getAssignedExtensions(link.config.slotName) : [link]))
    .find((link) => link.name === linkName);
  return page ? ({ ...page.meta, ...page.config }.path as string) : null;
}
