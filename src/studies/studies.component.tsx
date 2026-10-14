import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import {
  InlineNotification,
  SkeletonText,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tile,
} from '@carbon/react';
import { FacilityPictogram, isDesktop, useConfig, useLayoutType } from '@openmrs/esm-framework';
import { ActHomeCard } from '../act-home/act-home-card.component';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import { SessionLocationAndDate } from '../act-page-header/session-location-and-date.component';
import { type Config } from '../config-schema';
import { useReportDataset, type ReportRow } from '../reports/report-dataset.resource';
import styles from './studies.scss';

const sum = (reportRows: Array<ReportRow>, column: string) =>
  reportRows.reduce((total, row) => total + Number(row[column] ?? 0), 0);

const onTimePercent = (row: ReportRow) => {
  const timed = Number(row.bpg_timed ?? 0);
  return timed ? `${Math.round((Number(row.bpg_on_time ?? 0) / timed) * 100)}%` : '–';
};

export default function Studies() {
  const { t } = useTranslation();
  const desktop = isDesktop(useLayoutType());
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
      <ActPageHeader
        title={t('studies', 'Studies')}
        illustration={<FacilityPictogram />}
        actions={<SessionLocationAndDate />}
      />
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
            <ActHomeCard title={t('byFacility', 'By facility')}>
              <div className={styles.tableContainer}>
                <Table size={desktop ? 'sm' : 'lg'}>
                  <TableHead>
                    <TableRow>
                      <TableHeader>{t('facility', 'Facility')}</TableHeader>
                      <TableHeader>{t('patients', 'Patients')}</TableHeader>
                      <TableHeader>{t('adherence', 'Adherence')}</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell>
                          <SkeletonText />
                        </TableCell>
                        <TableCell>
                          <SkeletonText />
                        </TableCell>
                        <TableCell>
                          <SkeletonText />
                        </TableCell>
                      </TableRow>
                    ) : (
                      reportRows.map((row) => (
                        <TableRow key={String(row.facility_uuid ?? row.facility)}>
                          <TableCell>{row.facility as string}</TableCell>
                          <TableCell>
                            {t('activeCount', '{{count}} active', { count: Number(row.active_patients ?? 0) })}
                          </TableCell>
                          <TableCell>{onTimePercent(row)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </ActHomeCard>
          </>
        )}
      </div>
    </>
  );
}
