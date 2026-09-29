import React, { useMemo, useState } from 'react';
import dayjs from 'dayjs';
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
import { ConfigurableLink, formatDate, navigate, useConfig, usePagination } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { useScreenAccess } from '../access/screen-access.component';
import { useReportDataset, type ReportRow } from '../reports/report-dataset.resource';
import { parseReportDate } from '../reports/report-date';
import styles from './registry.scss';

const pageSizes = [25, 50, 100];

const chartUrl = (row: ReportRow) => '${openmrsSpaBase}' + `/patient/${row.patient_uuid}/chart`;

function nextConsultation(row: ReportRow) {
  const date = parseReportDate(row.next_consultation_date);
  return date ? formatDate(date, { time: false, noToday: true }) : '';
}

function RegistryTable() {
  const { t } = useTranslation();
  const { registry } = useConfig<Config>();
  const params = useMemo(() => ({ startDate: '1900-01-01', endDate: dayjs().format('YYYY-MM-DD') }), []);
  // Coming back from a chart reuses the rows rather than evaluating the whole report again.
  const { rows, isLoading, error } = useReportDataset(registry.report, params, { revalidateIfStale: false });
  const [pageSize, setPageSize] = useState(pageSizes[0]);
  const { results, currentPage, goTo } = usePagination(rows, pageSize);
  const text = (column: string) => (row: ReportRow) => String(row[column] ?? '');
  const columns: Array<{
    header: string;
    text: (row: ReportRow) => string;
    render?: (row: ReportRow) => React.ReactNode;
  }> = [
    {
      header: t('name', 'Name'),
      text: text('full_name'),
      render: (row) => <ConfigurableLink to={chartUrl(row)}>{String(row.full_name ?? '')}</ConfigurableLink>,
    },
    { header: t('actId', 'ACT ID'), text: text('rhd_id') },
    { header: t('age', 'Age'), text: text('age_years') },
    { header: t('sex', 'Sex'), text: text('sex') },
    { header: t('diagnosisCategory', 'Diagnosis category'), text: text('diagnosis_category') },
    { header: t('prophylaxisRegimen', 'Prophylaxis regimen'), text: text('prophylaxis_regimen') },
    { header: t('nextConsultation', 'Next consultation'), text: nextConsultation },
  ];

  if (error) {
    return (
      <InlineNotification
        kind="error"
        lowContrast
        hideCloseButton
        title={t('couldNotLoadRegistry', 'Could not load the registry')}
      />
    );
  }
  if (isLoading) {
    return (
      <div data-testid="registry-loading">
        <DataTableSkeleton columnCount={columns.length} showHeader={false} showToolbar={false} />
      </div>
    );
  }
  if (!rows.length) {
    return <p className={styles.message}>{t('noRegistryPatients', 'No patients are enrolled in the registry.')}</p>;
  }
  return (
    <>
      <Table>
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableHeader key={column.header}>{column.header}</TableHeader>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {results.map((row) => (
            <TableRow
              key={String(row.patient_uuid)}
              className={styles.row}
              onClick={(event) => (event.target as HTMLElement).closest('a') || navigate({ to: chartUrl(row) })}
            >
              {columns.map((column) => (
                <TableCell key={column.header}>{column.render ? column.render(row) : column.text(row)}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Pagination
        page={currentPage}
        pageSize={pageSize}
        pageSizes={pageSizes}
        totalItems={rows.length}
        onChange={({ page, pageSize: size }) => {
          setPageSize(size);
          goTo(page);
        }}
      />
    </>
  );
}

export default function Registry() {
  const { t } = useTranslation();
  const canSeeRegistry = useScreenAccess('registry');

  if (!canSeeRegistry) {
    return <p className={styles.message}>{t('noAccessToRegistry', 'You do not have access to the registry.')}</p>;
  }
  return (
    <div className={styles.registry}>
      <h1 className={styles.title}>{t('registry', 'Registry')}</h1>
      <RegistryTable />
    </div>
  );
}
