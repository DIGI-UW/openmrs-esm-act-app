import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableSkeleton, InlineNotification, Pagination, Tag } from '@carbon/react';
import { CardiologyPictogram, isDesktop, useLayoutType } from '@openmrs/esm-framework';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import { TableEmptyState } from '../table-filters/empty-state.component';
import { usePagedRows } from '../table-filters/paged-rows';
import { DueForProphylaxisTable } from './due-for-prophylaxis-table.component';
import { DueListToolbar } from './due-list-toolbar.component';
import { useDueFilter } from './due-list';
import { useDueList } from './due-for-prophylaxis.resource';
import styles from './due-for-prophylaxis.scss';

function DueList() {
  const { t } = useTranslation();
  const desktop = isDesktop(useLayoutType());
  const { rows, recorded, recordedError, checking, waiting, isLoading, error } = useDueList();
  const { filter, setFilter, counts, filtered } = useDueFilter(rows);
  const filters = useMemo(() => ({ filter }), [filter]);
  const { results, paginationProps } = usePagedRows(filtered, filters);

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
        <h2 className={styles.listTitle}>{t('dueWithinTwoDays', 'Due in the next 48 hours, due today or overdue')}</h2>
        {waiting ? <Tag type="red">{t('waitingCount', '{{count}} waiting', { count: waiting })}</Tag> : null}
      </div>
      <DueListToolbar filter={filter} counts={counts} onFilter={setFilter} rows={filtered} recorded={recorded} />
      {filtered.length ? (
        <>
          <DueForProphylaxisTable
            rows={results}
            recorded={recorded}
            recordedError={recordedError}
            checking={checking}
          />
          <Pagination {...paginationProps} />
        </>
      ) : (
        <TableEmptyState message={t('nobodyDueInThisList', 'No patients in this list')} />
      )}
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
