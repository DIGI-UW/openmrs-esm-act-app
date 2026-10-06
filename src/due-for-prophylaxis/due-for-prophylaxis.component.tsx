import React from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableSkeleton, InlineNotification, Pagination, Tag } from '@carbon/react';
import { CardiologyPictogram, isDesktop, useLayoutType } from '@openmrs/esm-framework';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import { TableEmptyState } from '../table-filters/empty-state.component';
import { usePagedRows } from '../table-filters/paged-rows';
import { DueForProphylaxisTable } from './due-for-prophylaxis-table.component';
import { useDueList } from './due-for-prophylaxis.resource';
import styles from './due-for-prophylaxis.scss';

const noFilters = {};

function DueList() {
  const { t } = useTranslation();
  const desktop = isDesktop(useLayoutType());
  const { rows, recorded, recordedError, waiting, isLoading, error } = useDueList();
  const { results, paginationProps } = usePagedRows(rows, noFilters);

  if (error) {
    return (
      <InlineNotification
        kind="error"
        lowContrast
        hideCloseButton
        title={t('couldNotLoadDueForProphylaxis', 'Could not load the patients due for prophylaxis')}
      />
    );
  }
  if (isLoading) {
    return (
      <DataTableSkeleton
        role="progressbar"
        columnCount={6}
        rowCount={paginationProps.pageSize}
        compact={desktop}
        zebra
        showHeader={false}
        showToolbar={false}
      />
    );
  }
  if (!rows.length) {
    return <TableEmptyState message={t('nobodyDueForProphylaxis', 'Nobody is due for prophylaxis')} />;
  }
  return (
    <>
      <div className={styles.listHeader}>
        <h2 className={styles.listTitle}>{t('dueTodayAndOverdue', 'Due today and overdue')}</h2>
        {waiting ? <Tag type="red">{t('waitingCount', '{{count}} waiting', { count: waiting })}</Tag> : null}
      </div>
      <DueForProphylaxisTable rows={results} recorded={recorded} recordedError={recordedError} />
      <Pagination {...paginationProps} />
    </>
  );
}

export default function DueForProphylaxis() {
  const { t } = useTranslation();
  return (
    <>
      <ActPageHeader title={t('dueForProphylaxis', 'Due for prophylaxis')} illustration={<CardiologyPictogram />} />
      <div className={styles.dueForProphylaxis}>
        <DueList />
      </div>
    </>
  );
}
