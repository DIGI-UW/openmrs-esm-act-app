import React, { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import {
  DataTableSkeleton,
  InlineNotification,
  Pagination,
  Search,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import {
  ConfigurableLink,
  FacilityPictogram,
  isDesktop,
  OpenmrsDatePicker,
  useConfig,
  useLayoutType,
} from '@openmrs/esm-framework';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import { useClinicLimit } from '../clinic-limit';
import { type Config } from '../config-schema';
import { useReportDataset } from '../reports/report-dataset.resource';
import { sortHeaderProps, sortItems, type ColumnSort } from '../table-filters/column-sort';
import { DownloadCsvButton } from '../table-filters/download-csv-button.component';
import { TableEmptyState } from '../table-filters/empty-state.component';
import { usePagedRows } from '../table-filters/paged-rows';
import { cellText, columnHeader, limitToClinics, matchesSearch, reportsFor, sortValue } from './report-catalogue';
import styles from './report-view.scss';

const isoDate = (date: Date) => dayjs(date).format('YYYY-MM-DD');

/** One of the Reports page's reports as a table over a period: sortable, searchable and downloadable as it is shown. */
export default function ReportView() {
  const { t } = useTranslation();
  const desktop = isDesktop(useLayoutType());
  const { reportCatalogue } = useConfig<Config>();
  const limit = useClinicLimit();
  const id = useMemo(() => new URLSearchParams(window.location.search).get('report'), []);
  const entry = reportsFor(reportCatalogue, limit).find((candidate) => candidate.id === id);
  const [startDate, setStartDate] = useState(() => dayjs().subtract(12, 'month').toDate());
  const [endDate, setEndDate] = useState(() => new Date());
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<ColumnSort | null>(null);
  const backwards = dayjs(startDate).isAfter(endDate, 'day');
  // Plain dates, as a zoned midnight reads as the day before on a server behind the browser's time zone.
  const params = useMemo(() => ({ startDate: isoDate(startDate), endDate: isoDate(endDate) }), [startDate, endDate]);
  const dataset = useReportDataset(entry && !backwards ? entry.report : null, params);
  const { columns } = dataset;

  const visible = useMemo(() => {
    if (!entry) {
      return [];
    }
    const held = limitToClinics(dataset.rows, entry, limit).filter((row) => matchesSearch(row, columns, search));
    const datatype = (key: string) => columns.find((column) => column.name === key)?.datatype ?? '';
    return sortItems(held, sort, (row, key) => sortValue(row[key], datatype(key)));
  }, [entry, dataset.rows, limit, columns, search, sort]);
  const filters = useMemo(() => ({ search, sort, startDate, endDate }), [search, sort, startDate, endDate]);
  const { results, paginationProps } = usePagedRows(visible, filters);

  const title = entry?.label ?? t('reports', 'Reports');
  const body = () => {
    if (limit.status === 'pending') {
      return <DataTableSkeleton role="progressbar" columnCount={5} rowCount={10} compact={desktop} zebra />;
    }
    if (!entry) {
      return (
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title={t('noSuchReport', 'There is no such report')}
        />
      );
    }
    if (dataset.error) {
      return (
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title={t('couldNotLoadReports', 'Could not load the report')}
        />
      );
    }
    if (backwards) {
      return null;
    }
    if (dataset.isLoading) {
      return (
        <DataTableSkeleton
          role="progressbar"
          columnCount={5}
          rowCount={paginationProps.pageSize}
          compact={desktop}
          zebra
          showHeader={false}
          showToolbar={false}
        />
      );
    }
    if (!dataset.rows.length) {
      return <TableEmptyState message={t('reportHasNoRows', 'The report has no rows for these dates')} />;
    }
    return (
      <>
        <p className={styles.count}>{t('rowCountReport', '{{count}} rows', { count: visible.length })}</p>
        {visible.length ? (
          <>
            <div className={styles.tableContainer}>
              <Table size={desktop ? 'sm' : 'lg'} useZebraStyles>
                <TableHead>
                  <TableRow>
                    {columns.map((column) => (
                      <TableHeader key={column.name} {...sortHeaderProps(sort, column.name, setSort)}>
                        {columnHeader(column)}
                      </TableHeader>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {results.map((row, index) => (
                    <TableRow key={index}>
                      {columns.map((column) => (
                        <TableCell key={column.name}>{cellText(row[column.name], column.datatype)}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination {...paginationProps} />
          </>
        ) : (
          <TableEmptyState message={t('noRowsMatchSearch', 'No rows match the search')} />
        )}
      </>
    );
  };

  return (
    <>
      <ActPageHeader title={title} illustration={<FacilityPictogram />} />
      <div className={styles.reportView}>
        <ConfigurableLink className={styles.link} to="${openmrsSpaBase}/home/act-reports">
          {t('backToReports', 'Back to Reports')}
        </ConfigurableLink>
        {entry && <p className={styles.description}>{entry.description}</p>}
        {entry && (
          <div className={styles.controls}>
            <OpenmrsDatePicker
              id="report-view-start-date"
              labelText={t('fromDate', 'From')}
              value={startDate}
              onChange={(date) => date && setStartDate(date)}
            />
            <OpenmrsDatePicker
              id="report-view-end-date"
              labelText={t('toDate', 'To')}
              value={endDate}
              invalid={backwards}
              invalidText={t('endBeforeStart', 'The end is before the start')}
              onChange={(date) => date && setEndDate(date)}
            />
            <Search
              className={styles.search}
              size={desktop ? 'md' : 'lg'}
              labelText={t('searchReport', 'Search the report')}
              placeholder={t('searchReport', 'Search the report')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <DownloadCsvButton
              name={entry.id}
              list={`report:${entry.label}`}
              identifiers
              filters={{ startDate: params.startDate, endDate: params.endDate, searched: search.trim() ? 'yes' : 'no' }}
              headers={columns.map(columnHeader)}
              rows={() => visible.map((row) => columns.map((column) => cellText(row[column.name], column.datatype)))}
              disabled={!visible.length}
              size="md"
            />
          </div>
        )}
        {body()}
      </div>
    </>
  );
}
