import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { InlineNotification, SkeletonText, Tile } from '@carbon/react';
import { FacilityPictogram, useConfig } from '@openmrs/esm-framework';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import { type Config } from '../config-schema';
import { ByFacilityTable } from '../programme-report/programme-report.component';
import { useReportDataset, type ReportRow } from '../reports/report-dataset.resource';
import styles from './studies.scss';

const sum = (reportRows: Array<ReportRow>, column: string) =>
  reportRows.reduce((total, row) => total + Number(row[column] ?? 0), 0);

export default function Studies() {
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
  const { rows: reportRows, isLoading, error } = useReportDataset(programmeReport.report, params);

  const timed = sum(reportRows, 'bpg_timed');
  const tiles = [
    { label: t('activePatients', 'Active patients'), value: sum(reportRows, 'active_patients') },
    { label: t('dueThisWeek', 'Due this week'), value: sum(reportRows, 'due_this_week'), tone: styles.blue },
    { label: t('overdue', 'Overdue'), value: sum(reportRows, 'overdue'), tone: styles.red },
    {
      label: t('bpgOnTimeRate', 'BPG on-time rate'),
      value: timed ? `${Math.round((sum(reportRows, 'bpg_on_time') / timed) * 100)}%` : '–',
      tone: styles.green,
    },
  ];

  return (
    <>
      <ActPageHeader title={t('studies', 'Studies')} illustration={<FacilityPictogram />} />
      <div className={styles.studies}>
        {error ? (
          <InlineNotification
            kind="error"
            lowContrast
            hideCloseButton
            title={t('couldNotLoadReports', 'Could not load the report')}
          />
        ) : (
          <>
            <div className={styles.tiles}>
              {tiles.map((tile) => (
                <Tile key={tile.label} className={styles.tile} data-testid="studies-tile">
                  <span className={styles.tileLabel}>{tile.label}</span>
                  {isLoading ? (
                    <SkeletonText heading width="40%" />
                  ) : (
                    <span className={`${styles.tileValue} ${tile.tone ?? ''}`}>{tile.value}</span>
                  )}
                </Tile>
              ))}
            </div>
            <ByFacilityTable rows={reportRows} isLoading={isLoading} />
          </>
        )}
      </div>
    </>
  );
}
