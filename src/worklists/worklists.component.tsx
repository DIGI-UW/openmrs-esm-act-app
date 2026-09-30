import React, { useMemo } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import {
  Button,
  DataTableSkeleton,
  InlineNotification,
  Pagination,
  SkeletonText,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { navigate, PatientListsPictogram, useConfig } from '@openmrs/esm-framework';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import { riskFirst, WorklistChoice, WorklistTileGrid } from '../act-home/worklist-tiles.component';
import { type Config } from '../config-schema';
import { patientChartUrl } from '../patient-chart-url';
import { useScreenAccess } from '../access/screen-access.component';
import { rowFlags } from '../registry/registry-filters';
import { useReportDataset, type ReportRow } from '../reports/report-dataset.resource';
import { type RhdFlagList, useRhdFlagLists } from '../rhd-flags/rhd-flag-lists.resource';
import { usePagedRows } from '../table-filters/paged-rows';
import { useUrlFilters } from '../table-filters/url-filters';
import styles from './worklists.scss';

const filterKeys = ['flag'] as const;

function WorklistPatients({ list }: { list: RhdFlagList }) {
  const { t } = useTranslation();
  const { registry } = useConfig<Config>();
  const params = useMemo(() => ({ startDate: '1900-01-01', endDate: dayjs().format('YYYY-MM-DD') }), []);
  const { rows, isLoading, error } = useReportDataset(registry.report, params);
  const shown = useMemo(() => rows.filter((row) => rowFlags(row).includes(list.flagName)), [rows, list]);
  const { results, paginationProps } = usePagedRows(shown, list);
  const text = (column: string) => (row: ReportRow) => String(row[column] ?? '');
  const columns: Array<{ key: string; header: string; render: (row: ReportRow) => React.ReactNode }> = [
    {
      key: 'patient',
      header: t('patient', 'Patient'),
      render: (row) => (
        <>
          {text('full_name')(row)}
          <span className={styles.actId}>{text('rhd_id')(row)}</span>
        </>
      ),
    },
    {
      key: 'ageSex',
      header: t('ageSex', 'Age, sex'),
      render: (row) => `${text('age_years')(row)} ${text('sex')(row)}`,
    },
    { key: 'diagnosis', header: t('diagnosis', 'Diagnosis'), render: text('diagnosis_category') },
    { key: 'prophylaxis', header: t('prophylaxis', 'Prophylaxis'), render: text('prophylaxis_regimen') },
    {
      key: 'open',
      header: '',
      render: (row) => (
        <Button kind="tertiary" size="sm" onClick={() => navigate({ to: patientChartUrl(row.patient_uuid) })}>
          {t('openChart', 'Open chart')}
        </Button>
      ),
    },
  ];

  if (error) {
    return (
      <InlineNotification
        kind="error"
        lowContrast
        hideCloseButton
        title={t('couldNotLoadWorklistPatients', 'Could not load the worklist patients')}
      />
    );
  }
  if (isLoading) {
    return (
      <div data-testid="worklist-patients-loading">
        <DataTableSkeleton columnCount={columns.length} zebra showHeader={false} showToolbar={false} />
      </div>
    );
  }
  if (!shown.length) {
    return <p className={styles.message}>{t('noWorklistPatients', 'No patients are on this list.')}</p>;
  }
  return (
    <>
      <div className={styles.tableContainer}>
        <Table useZebraStyles>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableHeader key={column.key}>{column.header}</TableHeader>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {results.map((row) => (
              <TableRow key={String(row.patient_uuid)}>
                {columns.map((column) => (
                  <TableCell key={column.key}>{column.render(row)}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pagination {...paginationProps} />
    </>
  );
}

function WorklistsContent() {
  const { t } = useTranslation();
  const { lists, isLoading, error } = useRhdFlagLists();
  const [filters, setFilters] = useUrlFilters(filterKeys);
  const ordered = riskFirst(lists);
  // A flag that is not one of the lists, or none, chooses the first list.
  const chosen = ordered.find((list) => list.flagName === filters.flag) ?? ordered[0];

  if (error) {
    return (
      <InlineNotification
        kind="error"
        lowContrast
        hideCloseButton
        title={t('couldNotLoadWorklists', 'Could not load the worklists')}
      />
    );
  }
  if (isLoading) {
    return (
      <div data-testid="worklists-loading">
        <SkeletonText paragraph lineCount={3} />
      </div>
    );
  }
  if (!chosen) {
    return <p className={styles.message}>{t('noRhdFlagLists', 'No RHD flag lists found')}</p>;
  }
  return (
    <>
      <WorklistTileGrid>
        {ordered.map((list) => (
          <WorklistChoice
            key={list.flagName}
            list={list}
            selected={list === chosen}
            onSelect={() => setFilters({ flag: list.flagName })}
          />
        ))}
      </WorklistTileGrid>
      <section className={styles.patients}>
        <h2 className={styles.title}>{chosen.flagName}</h2>
        <WorklistPatients list={chosen} />
      </section>
    </>
  );
}

export default function Worklists() {
  const { t } = useTranslation();
  const canSeeWorklists = useScreenAccess('worklists');

  if (!canSeeWorklists) {
    return <p className={styles.message}>{t('noAccessToWorklists', 'You do not have access to the worklists.')}</p>;
  }
  return (
    <>
      <ActPageHeader title={t('worklists', 'Worklists')} illustration={<PatientListsPictogram />} />
      <div className={styles.worklists}>
        <p className={styles.description}>{t('worklistsDescription', 'Patients needing action, by list')}</p>
        <WorklistsContent />
      </div>
    </>
  );
}
