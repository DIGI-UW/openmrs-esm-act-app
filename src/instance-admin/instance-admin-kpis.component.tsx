import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { SkeletonText, Tile } from '@carbon/react';
import { useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { useReportDataset, type ReportRow } from '../reports/report-dataset.resource';
import styles from './instance-admin-kpis.scss';

const sum = (reportRows: Array<ReportRow>, column: string) =>
  reportRows.reduce((total, row) => total + Number(row[column] ?? 0), 0);

/**
 * Four at-a-glance tiles: Active patients and Overdue prophylaxis read from the programme report; Entered this week and
 * Data completeness are placeholders matching the prototype until their endpoints land.
 */
export function InstanceAdminKpis() {
  const { t } = useTranslation();
  const { programmeReport } = useConfig<Config>();

  // The current month, as plain dates so the server reads them the same whatever its time zone.
  const params = useMemo(
    () => ({
      startDate: dayjs().startOf('month').format('YYYY-MM-DD'),
      endDate: dayjs().endOf('month').format('YYYY-MM-DD'),
    }),
    [],
  );
  const { rows, isLoading, error } = useReportDataset(programmeReport.report, params);

  const kpis = [
    {
      label: t('activePatients', 'Active patients'),
      value: error ? '–' : sum(rows, 'active_patients'),
      caption: t('acrossYourSites', 'across your sites'),
    },
    {
      label: t('overdueProphylaxis', 'Overdue prophylaxis'),
      value: error ? '–' : sum(rows, 'overdue'),
      caption: t('needsFollowUp', 'needs follow-up'),
      tone: styles.alert,
    },
    {
      label: t('enteredThisWeek', 'Entered this week'),
      value: 218,
      caption: t('formsSaved', 'forms saved'),
      tone: styles.info,
      static: true,
    },
    {
      label: t('dataCompleteness', 'Data completeness'),
      value: '94%',
      caption: t('keyFields', 'key fields'),
      tone: styles.success,
      static: true,
    },
  ];
  return (
    <div className={styles.kpis}>
      {kpis.map((kpi) => (
        <Tile key={kpi.label} className={styles.kpi} data-testid="instance-admin-kpi">
          <span className={styles.label}>{kpi.label}</span>
          {isLoading && !kpi.static ? (
            <SkeletonText heading width="40%" />
          ) : (
            <span className={`${styles.value} ${kpi.tone ?? ''}`}>{kpi.value}</span>
          )}
          <span className={styles.caption}>{kpi.caption}</span>
        </Tile>
      ))}
    </div>
  );
}
