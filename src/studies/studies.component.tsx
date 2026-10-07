import React from 'react';
import { useTranslation } from 'react-i18next';
import { SkeletonText, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tag, Tile } from '@carbon/react';
import { FacilityPictogram, isDesktop, useLayoutType } from '@openmrs/esm-framework';
import { ActHomeCard } from '../act-home/act-home-card.component';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import { SessionLocationAndDate } from '../act-page-header/session-location-and-date.component';
import { useActivePatientCount } from './active-patients.resource';
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

// Placeholders for KPIs the backend module does not expose yet.
const kpis = { dueThisWeek: 64, overdue: 41, bpgOnTimeRate: 86 };

export default function Studies() {
  const { t } = useTranslation();
  const desktop = isDesktop(useLayoutType());
  const { count: activePatients, isLoading: isLoadingActive, error: activeError } = useActivePatientCount();

  const tagLabels: Record<DataStatus, string> = {
    Complete: t('dataComplete', 'Complete'),
    Review: t('dataReview', 'Review'),
    Duplicates: t('dataDuplicates', 'Duplicates'),
  };

  const tiles = [
    {
      label: t('activePatients', 'Active patients'),
      value: activeError ? '–' : (activePatients ?? 0).toLocaleString(),
      loading: isLoadingActive,
    },
    { label: t('dueThisWeek', 'Due this week'), value: kpis.dueThisWeek.toLocaleString(), tone: styles.blue },
    { label: t('overdue', 'Overdue'), value: kpis.overdue.toLocaleString(), tone: styles.red },
    { label: t('bpgOnTimeRate', 'BPG on-time rate'), value: `${kpis.bpgOnTimeRate}%`, tone: styles.green },
  ];

  return (
    <>
      <ActPageHeader
        title={t('studies', 'Studies')}
        illustration={<FacilityPictogram />}
        actions={<SessionLocationAndDate />}
      />
      <div className={styles.studies}>
        <div className={styles.tiles}>
          {tiles.map((tile) => (
            <Tile key={tile.label} className={styles.tile} data-testid="studies-tile">
              <span className={styles.tileLabel}>{tile.label}</span>
              {tile.loading ? (
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
