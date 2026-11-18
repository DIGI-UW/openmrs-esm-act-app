import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { type Figure, FigureTiles } from '../figure-tiles/figure-tiles.component';
import { useReportDataset, type ReportRow } from '../reports/report-dataset.resource';

const sum = (reportRows: Array<ReportRow>, column: string) =>
  reportRows.reduce((total, row) => total + Number(row[column] ?? 0), 0);

/** A count column of the KPI report's one row, or null when the row or the column is missing. */
const count = (row: ReportRow | undefined, column: string) => {
  const value = row?.[column];
  return value === null || value === undefined || value === '' || Number.isNaN(Number(value)) ? null : Number(value);
};

/**
 * The share of patients on the registry now, and alive, who carry no missing-data flag, as a whole percentage; null
 * with nobody to count.
 */
export function dataCompleteness(row: ReportRow | undefined) {
  const active = count(row, 'active_patients');
  const complete = count(row, 'active_complete');
  if (!active || complete === null) {
    return null;
  }
  return Math.round((100 * complete) / active);
}

/**
 * Four at-a-glance tiles, from the programme report for the month and the KPI report for the last seven days. Both
 * return counts only, so the page downloads no patient rows.
 */
export function InstanceAdminKpis() {
  const { t } = useTranslation();
  const { programmeReport, instanceAdminKpis } = useConfig<Config>();

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
  const counts = useReportDataset(instanceAdminKpis.report, week);
  const row = counts.rows[0];
  const entered = count(row, 'encounters');
  const completeness = dataCompleteness(row);

  const kpis: Array<Figure> = [
    {
      key: 'active',
      label: t('activePatients', 'Active patients'),
      value: programme.error ? '–' : sum(programme.rows, 'active_patients'),
      caption: t('acrossYourSites', 'across your sites'),
      loading: programme.isLoading,
    },
    {
      key: 'overdue',
      label: t('overdueProphylaxis', 'Overdue prophylaxis'),
      value: programme.error ? '–' : sum(programme.rows, 'overdue'),
      caption: t('needsFollowUp', 'needs follow-up'),
      tone: 'alert',
      loading: programme.isLoading,
    },
    {
      key: 'entered',
      label: t('enteredThisWeek', 'Entered this week'),
      value: counts.error || entered === null ? '–' : entered,
      // The report filters on each form's own date, not the day it was saved, as the encounters export does.
      caption: t('formsDatedLastSevenDays', 'forms dated in the last 7 days'),
      tone: 'info',
      loading: counts.isLoading,
    },
    {
      key: 'completeness',
      label: t('dataCompleteness', 'Data completeness'),
      value: counts.error || completeness === null ? '–' : `${completeness}%`,
      caption: t('activePatientsWithNoMissingData', 'active patients with no missing data'),
      tone: 'success',
      loading: counts.isLoading,
    },
  ];
  return <FigureTiles figures={kpis} columns={4} testId="instance-admin-kpi" />;
}
