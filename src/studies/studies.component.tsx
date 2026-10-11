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
  Tag,
  Tile,
} from '@carbon/react';
import { FacilityPictogram, isDesktop, useConfig, useLayoutType } from '@openmrs/esm-framework';
import { ActHomeCard } from '../act-home/act-home-card.component';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import { SessionLocationAndDate } from '../act-page-header/session-location-and-date.component';
import { type Config } from '../config-schema';
import { useReportDataset, type ReportRow } from '../reports/report-dataset.resource';
import styles from './studies.scss';

type DataStatus = 'Complete' | 'Review' | 'Duplicates';

const tagTypes: Record<DataStatus, 'green' | 'gray' | 'red'> = {
  Complete: 'green',
  Review: 'gray',
  Duplicates: 'red',
};

interface StudyRow {
  facility: string;
  patients: number;
  adherence: number;
  dataStatus: DataStatus;
}

// Placeholder rows until the backend module provides the dataset.
const rows: Array<StudyRow> = [
  { facility: 'Kiswa HC III', patients: 142, adherence: 91, dataStatus: 'Complete' },
  { facility: 'Mulago Cardiac Clinic', patients: 388, adherence: 87, dataStatus: 'Complete' },
  { facility: 'Nakawa HC IV', patients: 96, adherence: 78, dataStatus: 'Review' },
  { facility: 'Wakiso HC IV', patients: 121, adherence: 72, dataStatus: 'Duplicates' },
];

const sum = (reportRows: Array<ReportRow>, column: string) =>
  reportRows.reduce((total, row) => total + Number(row[column] ?? 0), 0);

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

  const tagLabels: Record<DataStatus, string> = {
    Complete: t('dataComplete', 'Complete'),
    Review: t('dataReview', 'Review'),
    Duplicates: t('dataDuplicates', 'Duplicates'),
  };

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
        )}
        <ActHomeCard title={t('byFacility', 'By facility')}>
          <div className={styles.tableContainer}>
            <Table size={desktop ? 'sm' : 'lg'}>
              <TableHead>
                <TableRow>
                  <TableHeader>{t('facility', 'Facility')}</TableHeader>
                  <TableHeader>{t('patients', 'Patients')}</TableHeader>
                  <TableHeader>{t('adherence', 'Adherence')}</TableHeader>
                  <TableHeader>{t('data', 'Data')}</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.facility}>
                    <TableCell>{row.facility}</TableCell>
                    <TableCell>{t('activeCount', '{{count}} active', { count: row.patients })}</TableCell>
                    <TableCell>{`${row.adherence}%`}</TableCell>
                    <TableCell>
                      <Tag
                        type={tagTypes[row.dataStatus]}
                        size="sm"
                        className={row.dataStatus === 'Review' ? styles.review : undefined}
                      >
                        {tagLabels[row.dataStatus]}
                      </Tag>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ActHomeCard>
      </div>
    </>
  );
}
