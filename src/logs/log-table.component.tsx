import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTableSkeleton,
  InlineNotification,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableExpandedRow,
  TableExpandHeader,
  TableHead,
  TableHeader,
  TableRow,
  TableExpandRow,
} from '@carbon/react';
import { isDesktop, useLayoutType } from '@openmrs/esm-framework';
import { restErrorMessage } from '../rest-error-message';
import { FilterEmptyState, TableEmptyState } from '../table-filters/empty-state.component';
import { type LogUser, PAGE_SIZES, type Paging } from './logs.resource';
import styles from './logs.scss';

/** Carbon's tag colours, as the tabs colour their kinds. */
export type TagType =
  | 'red'
  | 'magenta'
  | 'purple'
  | 'blue'
  | 'cyan'
  | 'teal'
  | 'green'
  | 'gray'
  | 'cool-gray'
  | 'warm-gray'
  | 'high-contrast'
  | 'outline';

/** One entry in ACT 2.0's format: Time, User, Action, Target, with its detail in the expanded row. */
export interface LogRow {
  key: string;
  time: React.ReactNode;
  user: React.ReactNode;
  action: React.ReactNode;
  target: React.ReactNode;
  /** A tab's extra columns, after Target. */
  cells?: Array<React.ReactNode>;
  detail: React.ReactNode;
}

interface LogTableProps {
  label: string;
  /** The extra columns' headers, after Target. */
  columns?: Array<string>;
  rows: Array<LogRow>;
  totalCount: number;
  paging: Paging;
  onPage: (paging: Paging) => void;
  isLoading: boolean;
  error?: Error;
  /** Whether the user set a filter, which decides which empty state shows. */
  filtered: boolean;
  emptyMessage: string;
}

/** The user cell: the person's name over their username and ACT role. */
export function LogUserCell({ user }: { user: LogUser | null }) {
  const { t } = useTranslation();
  if (!user?.username && !user?.display) {
    return <span className={styles.muted}>{t('unknownUser', 'unknown')}</span>;
  }
  const subline = [user.display ? user.username : null, user.role].filter(Boolean).join(' · ');
  return (
    <>
      <span>{user.display || user.username}</span>
      {subline && <span className={styles.subline}>{subline}</span>}
    </>
  );
}

/** The action cell: a tag or a bold verb, the object beside it, and a summary line beneath. */
export function LogActionCell({
  tag,
  text,
  summary,
}: {
  tag?: React.ReactNode;
  text?: React.ReactNode;
  summary?: React.ReactNode;
}) {
  return (
    <>
      <span className={styles.action}>
        {tag}
        {text && <strong>{text}</strong>}
      </span>
      {summary && <span className={styles.subline}>{summary}</span>}
    </>
  );
}

/** A patient as a target: the name, then the ACT ID in a fixed-width face as ACT 2.0 printed IDs. */
export function LogTargetCell({ display, id }: { display: React.ReactNode; id?: string | null }) {
  return (
    <>
      {display}
      {id && <code className={styles.actId}>{id}</code>}
    </>
  );
}

/** A label and value in the expanded row's right column. */
export function DetailLine({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className={styles.detailLine} data-testid="detail-line">
      <strong>{label}</strong> {children}
    </p>
  );
}

/**
 * Every tab's table: ACT 2.0's Time, User, Action, Target, newest first, with each entry's detail behind the
 * expand control, and a page of the server's rows at a time.
 */
export function LogTable({
  label,
  columns = [],
  rows,
  totalCount,
  paging,
  onPage,
  isLoading,
  error,
  filtered,
  emptyMessage,
}: LogTableProps) {
  const { t } = useTranslation();
  const desktop = isDesktop(useLayoutType());
  const [expanded, setExpanded] = useState<string | null>(null);
  const headers = [t('time', 'Time'), t('user', 'User'), t('action', 'Action'), t('target', 'Target'), ...columns];

  if (error) {
    return (
      <InlineNotification
        kind="error"
        lowContrast
        hideCloseButton
        title={t('couldNotLoadLog', 'Could not load the log')}
        subtitle={restErrorMessage(error)}
      />
    );
  }
  if (isLoading && !rows.length) {
    return (
      <DataTableSkeleton
        role="progressbar"
        columnCount={headers.length + 1}
        compact={desktop}
        showHeader={false}
        showToolbar={false}
      />
    );
  }
  if (!rows.length) {
    return filtered ? (
      <FilterEmptyState message={t('noLogEntriesMatch', 'No entries match')} />
    ) : (
      <TableEmptyState message={emptyMessage} />
    );
  }
  return (
    <div className={styles.tableContainer}>
      <Table aria-label={label} size={desktop ? 'sm' : 'lg'}>
        <TableHead>
          <TableRow>
            <TableExpandHeader aria-label={t('details', 'Details')} />
            {headers.map((header) => (
              <TableHeader key={header}>{header}</TableHeader>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <React.Fragment key={row.key}>
              <TableExpandRow
                aria-label={t('details', 'Details')}
                isExpanded={expanded === row.key}
                onExpand={() => setExpanded(expanded === row.key ? null : row.key)}
                className={expanded === row.key ? styles.expandedRow : undefined}
              >
                <TableCell className={styles.timeCell}>{row.time}</TableCell>
                <TableCell className={styles.stacked}>{row.user}</TableCell>
                <TableCell className={styles.stacked}>{row.action}</TableCell>
                <TableCell>{row.target}</TableCell>
                {row.cells?.map((cell, index) => <TableCell key={columns[index]}>{cell}</TableCell>)}
              </TableExpandRow>
              {expanded === row.key && (
                <TableExpandedRow colSpan={headers.length + 1}>
                  <div className={styles.detail} data-testid="log-detail">
                    {row.detail}
                  </div>
                </TableExpandedRow>
              )}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
      <div className={styles.footer}>
        <span className={styles.newestFirst}>{t('newestFirst', 'Newest first')}</span>
        <Pagination
          page={Math.floor(paging.startIndex / paging.limit) + 1}
          pageSize={paging.limit}
          pageSizes={PAGE_SIZES}
          totalItems={totalCount}
          onChange={({ page, pageSize }) => onPage({ startIndex: (page - 1) * pageSize, limit: pageSize })}
        />
      </div>
    </div>
  );
}
