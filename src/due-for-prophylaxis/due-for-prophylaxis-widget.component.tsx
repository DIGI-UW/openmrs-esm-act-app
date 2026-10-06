import React from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableSkeleton, InlineNotification, Tag } from '@carbon/react';
import { isDesktop, useLayoutType } from '@openmrs/esm-framework';
import { ActHomeCard } from '../act-home/act-home-card.component';
import { TableEmptyState } from '../table-filters/empty-state.component';
import { DueForProphylaxisTable } from './due-for-prophylaxis-table.component';
import { dueForProphylaxisDashboardMeta } from './due-for-prophylaxis.meta';
import { useDueList } from './due-for-prophylaxis.resource';

const shownRows = 5;

/** A home page's Due for prophylaxis: its first rows and how many of all are waiting, linking to the full list. */
export default function DueForProphylaxisWidget() {
  const { t } = useTranslation();
  const desktop = isDesktop(useLayoutType());
  const { rows, recorded, waiting, isLoading, error } = useDueList();

  return (
    <ActHomeCard
      title={t('dueForProphylaxis', 'Due for prophylaxis')}
      tag={rows.length ? <Tag type="red">{t('waitingCount', '{{count}} waiting', { count: waiting })}</Tag> : null}
      link={{ label: t('open', 'Open'), to: `\${openmrsSpaBase}/home/${dueForProphylaxisDashboardMeta.name}` }}
    >
      {error ? (
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title={t('couldNotLoadDueForProphylaxis', 'Could not load the patients due for prophylaxis')}
        />
      ) : isLoading ? (
        <DataTableSkeleton
          role="progressbar"
          columnCount={6}
          rowCount={shownRows}
          compact={desktop}
          zebra
          showHeader={false}
          showToolbar={false}
        />
      ) : rows.length ? (
        <DueForProphylaxisTable rows={rows.slice(0, shownRows)} recorded={recorded} />
      ) : (
        <TableEmptyState message={t('nobodyDueForProphylaxis', 'Nobody is due for prophylaxis')} />
      )}
    </ActHomeCard>
  );
}
