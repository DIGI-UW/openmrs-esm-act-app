import { useMemo } from 'react';
import dayjs from 'dayjs';
import { useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { useReportDataset } from '../reports/report-dataset.resource';

/** The registry report's rows: every patient on the registry, as the Registry and the worklists show them. */
export function useRegistryReport() {
  const { registry } = useConfig<Config>();
  const params = useMemo(() => ({ startDate: '1900-01-01', endDate: dayjs().format('YYYY-MM-DD') }), []);
  return useReportDataset(registry.report, params);
}
