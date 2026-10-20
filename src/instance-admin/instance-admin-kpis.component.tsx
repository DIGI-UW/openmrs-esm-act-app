import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { SkeletonText, Tile } from '@carbon/react';
import { useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { rowFlags } from '../registry/registry-filters';
import { onRegistryNow, useRegistryReport } from '../registry/registry.resource';
import { useReportDataset, type ReportRow } from '../reports/report-dataset.resource';
import { flagPriority } from '../rhd-flags/rhd-flag-lists.resource';
import styles from './instance-admin-kpis.scss';

const sum = (reportRows: Array<ReportRow>, column: string) =>
  reportRows.reduce((total, row) => total + Number(row[column] ?? 0), 0);

/**
 * The share of patients on the registry now, and alive, who carry no missing-data flag, as a whole percentage; null
 * with nobody to count.
 */
export function dataCompleteness(rows: Array<ReportRow>, flagLists: Config['flagLists']) {
  const active = rows.filter(onRegistryNow);
  if (!active.length) {
    return null;
  }
  const complete = active.filter(
    (row) => !rowFlags(row).some((flag) => flagPriority(flagLists, flag) === 'dataQuality'),
  ).length;
  return Math.round((100 * complete) / active.length);
}

/**
 * Four at-a-glance tiles. Active patients and Overdue prophylaxis total the programme report for this month over every
 * clinic; Entered this week counts the RHD encounters of the last seven days; Data completeness is the share of
 * active patients with no missing-data flag.
 */
export function InstanceAdminKpis() {
  const { t } = useTranslation();
  const { programmeReport, instanceAdminKpis, flagLists } = useConfig<Config>();

  // Plain dates, so the server reads them the same whatever its time zone.
  const month = useMemo(
    () => ({
      startDate: dayjs().startOf('month').format('YYYY-MM-DD'),
      endDate: dayjs().endOf('month').format('YYYY-MM-DD'),
    }),
    [],
  );
  const week = useMemo(
    () => ({ startDate: dayjs().subtract(6, 'day').format('YYYY-MM-DD'), endDate: dayjs().format('YYYY-MM-DD') }),
    [],
  );
  const programme = useReportDataset(programmeReport.report, month);
  const entered = useReportDataset(instanceAdminKpis.encountersReport, week);
  const registry = useRegistryReport();
  const completeness = useMemo(() => dataCompleteness(registry.rows, flagLists), [registry.rows, flagLists]);

  const kpis = [
    {
      label: t('activePatients', 'Active patients'),
      value: programme.error ? '–' : sum(programme.rows, 'active_patients'),
      caption: t('acrossYourSites', 'across your sites'),
      loading: programme.isLoading,
    },
    {
      label: t('overdueProphylaxis', 'Overdue prophylaxis'),
      value: programme.error ? '–' : sum(programme.rows, 'overdue'),
      caption: t('needsFollowUp', 'needs follow-up'),
      tone: styles.alert,
      loading: programme.isLoading,
    },
    {
      label: t('enteredThisWeek', 'Entered this week'),
      value: entered.error ? '–' : entered.rows.length,
      // The encounters export filters on each form's own date, not the day it was saved.
      caption: t('formsDatedLastSevenDays', 'forms dated in the last 7 days'),
      tone: styles.info,
      loading: entered.isLoading,
    },
    {
      label: t('dataCompleteness', 'Data completeness'),
      value: registry.error || completeness === null ? '–' : `${completeness}%`,
      caption: t('activePatientsWithNoMissingData', 'active patients with no missing data'),
      tone: styles.success,
      loading: registry.isLoading,
    },
  ];
  return (
    <div className={styles.kpis}>
      {kpis.map((kpi) => (
        <Tile key={kpi.label} className={styles.kpi} data-testid="instance-admin-kpi">
          <span className={styles.label}>{kpi.label}</span>
          {kpi.loading ? (
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
