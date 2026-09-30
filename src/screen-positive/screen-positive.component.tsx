import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTableSkeleton,
  InlineNotification,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import {
  CardiologyPictogram,
  ConfigurableLink,
  formatDate,
  isDesktop,
  useConfig,
  useLayoutType,
} from '@openmrs/esm-framework';
import { ActPage, ActPageHeader } from '../act-page-header/act-page-header.component';
import { type Config } from '../config-schema';
import { patientChartUrl } from '../patient-chart-url';
import { useScreenAccess } from '../access/screen-access.component';
import { useReportDataset, type ReportRow } from '../reports/report-dataset.resource';
import { parseReportDate } from '../reports/report-date';
import { FilterSelect } from '../table-filters/filter-select.component';
import { distinctValues } from '../table-filters/distinct-values';
import { usePagedRows } from '../table-filters/paged-rows';
import {
  filterColumns,
  filterScreenPositive,
  type ScreenPositiveFilters,
  useScreenPositiveFilters,
} from './screen-positive-filters';
import styles from './screen-positive.scss';

function screenDate(row: ReportRow) {
  const date = parseReportDate(row.screen_date);
  return date ? formatDate(date, { time: false, noToday: true }) : '';
}

function ScreenPositiveTable() {
  const { t } = useTranslation();
  const { screenPositive } = useConfig<Config>();
  const desktop = isDesktop(useLayoutType());
  const { rows, isLoading, error } = useReportDataset(screenPositive.report);
  const [filters, setFilters] = useScreenPositiveFilters();
  const shown = useMemo(() => filterScreenPositive(rows, filters), [rows, filters]);
  const { results, paginationProps } = usePagedRows(shown, filters);
  const filterSelect = (key: keyof ScreenPositiveFilters, label: string) => (
    <FilterSelect
      id={`screen-positive-${key}`}
      label={label}
      value={filters[key]}
      options={distinctValues(rows, filterColumns[key])}
      onChange={(value) => setFilters({ [key]: value })}
    />
  );
  const text = (column: string) => (row: ReportRow) => String(row[column] ?? '');
  const columns: Array<{ header: string; render: (row: ReportRow) => React.ReactNode }> = [
    { header: t('actId', 'ACT ID'), render: text('rhd_id') },
    {
      header: t('name', 'Name'),
      render: (row) => (
        <ConfigurableLink to={patientChartUrl(row.patient_uuid)}>{String(row.full_name ?? '')}</ConfigurableLink>
      ),
    },
    { header: t('age', 'Age'), render: text('age_years') },
    { header: t('sex', 'Sex'), render: text('sex') },
    { header: t('cardiacClinic', 'Cardiac clinic'), render: text('cardiac_clinic') },
    { header: t('primaryCareClinic', 'Primary care clinic'), render: text('primary_care_clinic') },
    { header: t('dateOfPositiveScreen', 'Date of positive screen'), render: screenDate },
  ];

  if (error) {
    return (
      <InlineNotification
        kind="error"
        lowContrast
        hideCloseButton
        title={t('couldNotLoadScreenPositive', 'Could not load the screen positive list')}
      />
    );
  }
  if (isLoading) {
    return (
      <DataTableSkeleton
        role="progressbar"
        columnCount={columns.length}
        rowCount={paginationProps.pageSize}
        compact={desktop}
        zebra
        showHeader={false}
        showToolbar={false}
      />
    );
  }
  if (!rows.length) {
    return (
      <p className={styles.message}>
        {t('noScreenPositivePatients', 'No screen positive patients are waiting for a confirmatory echo.')}
      </p>
    );
  }
  return (
    <>
      <div className={styles.filters}>
        {filterSelect('cardiac', t('cardiacClinic', 'Cardiac clinic'))}
        {filterSelect('sex', t('sex', 'Sex'))}
      </div>
      {shown.length ? (
        <div className={styles.tableContainer}>
          <Table size={desktop ? 'sm' : 'lg'} useZebraStyles>
            <TableHead>
              <TableRow>
                {columns.map((column) => (
                  <TableHeader key={column.header}>{column.header}</TableHeader>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {results.map((row) => (
                <TableRow key={String(row.patient_uuid)}>
                  {columns.map((column) => (
                    <TableCell key={column.header}>{column.render(row)}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className={styles.message}>{t('noScreenPositiveMatches', 'No patients match these filters.')}</p>
      )}
      {shown.length > 0 && <Pagination {...paginationProps} />}
    </>
  );
}

export default function ScreenPositive() {
  const { t } = useTranslation();
  const canSeeScreenPositive = useScreenAccess('screenPositive');

  if (!canSeeScreenPositive) {
    return (
      <p className={styles.message}>
        {t('noAccessToScreenPositive', 'You do not have access to the screen positive, pending confirmation list.')}
      </p>
    );
  }
  return (
    <ActPage>
      <ActPageHeader
        title={t('screenPositive', 'Screen positive, pending confirmation')}
        illustration={<CardiologyPictogram />}
      />
      <div className={styles.screenPositive}>
        <p className={styles.description}>
          {t('screenPositiveDescription', 'Registry patients who screened positive and wait for a confirmatory echo')}
        </p>
        <ScreenPositiveTable />
      </div>
    </ActPage>
  );
}
