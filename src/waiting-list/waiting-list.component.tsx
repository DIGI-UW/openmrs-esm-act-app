import React, { useState } from 'react';
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
import { useConfig, usePagination } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { useScreenAccess } from '../access/screen-access.component';
import { useReportDataset, type ReportRow } from '../reports/report-dataset.resource';
import styles from './waiting-list.scss';

const pageSizes = [25, 50, 100];

function WaitingListTable() {
  const { t } = useTranslation();
  const { waitingList } = useConfig<Config>();
  const { rows, isLoading, error } = useReportDataset(waitingList.report);
  const [pageSize, setPageSize] = useState(pageSizes[0]);
  const { results, currentPage, goTo } = usePagination(rows, pageSize);
  const text = (column: string) => (row: ReportRow) => String(row[column] ?? '');
  const columns: Array<{ header: string; text: (row: ReportRow) => string }> = [
    { header: t('actId', 'ACT ID'), text: text('rhd_id') },
    { header: t('sex', 'Sex'), text: text('sex') },
    { header: t('age', 'Age'), text: text('age_years') },
    { header: t('procedureType', 'Type'), text: text('procedure_type') },
    { header: t('procedure', 'Procedure'), text: text('procedure_name') },
    { header: t('urgency', 'Urgency'), text: text('urgency') },
    { header: t('district', 'District'), text: text('district') },
    { header: t('contraindications', 'Contraindications'), text: text('contraindications') },
    { header: t('suitableForRepair', 'Suitable for repair'), text: text('suitable_for_repair') },
  ];

  if (error) {
    return (
      <InlineNotification
        kind="error"
        lowContrast
        hideCloseButton
        title={t('couldNotLoadWaitingList', 'Could not load the procedural waiting list')}
      />
    );
  }
  if (isLoading) {
    return (
      <div data-testid="waiting-list-loading">
        <DataTableSkeleton columnCount={columns.length} showHeader={false} showToolbar={false} />
      </div>
    );
  }
  if (!rows.length) {
    return (
      <p className={styles.message}>{t('noWaitingRecommendations', 'No procedural recommendations are waiting.')}</p>
    );
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
            <TableRow key={String(row.recommendation_uuid)}>
              {columns.map((column) => (
                <TableCell key={column.header}>{column.text(row)}</TableCell>
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

export default function WaitingList() {
  const { t } = useTranslation();
  const canSeeWaitingList = useScreenAccess('waitingList');

  if (!canSeeWaitingList) {
    return (
      <p className={styles.message}>
        {t('noAccessToWaitingList', 'You do not have access to the procedural waiting list.')}
      </p>
    );
  }
  return (
    <div className={styles.waitingList}>
      <h1 className={styles.title}>{t('waitingList', 'Procedural waiting list')}</h1>
      <WaitingListTable />
    </div>
  );
}
