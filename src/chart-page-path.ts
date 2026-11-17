import { useCallback } from 'react';
import { getAssignedExtensions, getExtensionStore, useAssignedExtensions, useStore } from '@openmrs/esm-framework';

/** A chart page's path, found in the chart's nav as ChartReview finds dashboards, or null when it is not there. */
export function useChartPagePath(linkName: string) {
  const links = useAssignedExtensions('patient-chart-dashboard-slot');
  // A selector, so a dashboard group's slot filling re-renders only when the path changes.
  const selectPath = useCallback(() => {
    const page = links
      .flatMap((link) => (link.config?.slotName ? getAssignedExtensions(link.config.slotName) : [link]))
      .find((link) => link.name === linkName);
    return page ? ({ ...page.meta, ...page.config }.path as string) : null;
  }, [links, linkName]);
  return useStore(getExtensionStore(), selectPath);
}
