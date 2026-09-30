import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  InlineNotification,
  SkeletonText,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { ScreenAccess } from '../access/screen-access.component';
import { useReportDataset } from '../reports/report-dataset.resource';
import { rankWaitingRows, type WaitingRow } from '../waiting-list/urgency';
import { waitingListDashboardMeta } from '../waiting-list/waiting-list.meta';
import { ActHomeCard } from './act-home-card.component';
import styles from './waiting-list-summary.scss';

const shownRows = 5;

function Summary() {
  const { t } = useTranslation();
  const { waitingList, urgencyBands } = useConfig<Config>();
  const { rows, isLoading, error } = useReportDataset(waitingList.report);
  // The page's ranking with no filter applied, so these are its first rows.
  const mostUrgent = useMemo(() => rankWaitingRows(rows, urgencyBands).slice(0, shownRows), [rows, urgencyBands]);
  const text = (column: string) => (waiting: WaitingRow) => String(waiting.row[column] ?? '');
  const columns: Array<{ header: string; text: (waiting: WaitingRow) => string; daysPending?: boolean }> = [
    { header: t('actId', 'ACT ID'), text: text('rhd_id') },
    { header: t('procedureType', 'Type'), text: text('procedure_type') },
    { header: t('procedure', 'Procedure'), text: text('procedure_name') },
    { header: t('urgency', 'Urgency'), text: text('urgency') },
    {
      header: t('daysPending', 'Days pending'),
      text: (waiting) => String(waiting.daysPending ?? ''),
      daysPending: true,
    },
  ];

  return (
    <ActHomeCard
      title={t('waitingListMostUrgent', 'Procedural waiting list, most urgent first')}
      link={{ label: t('open', 'Open'), to: `\${openmrsSpaBase}/home/${waitingListDashboardMeta.name}` }}
    >
      {error ? (
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title={t('couldNotLoadWaitingList', 'Could not load the procedural waiting list')}
        />
      ) : isLoading ? (
        <div data-testid="waiting-list-summary-loading">
          <SkeletonText paragraph lineCount={5} />
        </div>
      ) : mostUrgent.length ? (
        <div className={styles.tableContainer}>
          <Table size="sm" useZebraStyles>
            <TableHead>
              <TableRow>
                {columns.map((column) => (
                  <TableHeader key={column.header}>{column.header}</TableHeader>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {mostUrgent.map((waiting) => (
                <TableRow key={String(waiting.row.recommendation_uuid)} data-overdue={waiting.overdue}>
                  {columns.map((column) => (
                    <TableCell key={column.header} data-days-pending={column.daysPending}>
                      {column.text(waiting)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className={styles.empty}>{t('noWaitingRecommendations', 'No procedural recommendations are waiting.')}</p>
      )}
    </ActHomeCard>
  );
}

export default function WaitingListSummary() {
  return (
    <ScreenAccess screen="waitingList">
      <Summary />
    </ScreenAccess>
  );
}
