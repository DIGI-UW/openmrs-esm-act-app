import React from 'react';
import { DataTableSkeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@carbon/react';
import { CardHeader, EmptyCard, ErrorState, isDesktop, useLayoutType } from '@openmrs/esm-framework';
import { useMayEnterForm } from '../access/may-enter-form';
import { RecordFormButton } from '../access/record-form-button.component';
import { useOpenFormInVisit } from '../visits/open-form-in-visit';
import styles from './chart-table-card.scss';

export interface ChartTableColumn<T> {
  header: string;
  text: (row: T) => string;
}

interface ChartTableCardProps<T> {
  patientUuid: string;
  title: string;
  /** What the empty state calls the rows, in lower case. */
  rowsName: string;
  /** The form the card's action opens, and its label; the action shows only to a user who may record the form. */
  form: string;
  actionLabel: string;
  columns: Array<ChartTableColumn<T>>;
  rows: Array<T>;
  rowKey: (row: T) => string;
  isLoading: boolean;
  error?: Error;
}

/** A chart page's table of the patient's records, newest first, with the form to record another. */
export function ChartTableCard<T>({
  patientUuid,
  title,
  rowsName,
  form,
  actionLabel,
  columns,
  rows,
  rowKey,
  isLoading,
  error,
}: ChartTableCardProps<T>) {
  const desktop = isDesktop(useLayoutType());
  const opener = useOpenFormInVisit(patientUuid);
  // EmptyCard takes a callback, not a RecordFormButton, so its action is gated here.
  const mayRecord = useMayEnterForm(form);
  const record = () => opener.open(form);

  if (error) {
    return <ErrorState error={error} headerTitle={title} />;
  }
  if (!isLoading && !rows.length) {
    return <EmptyCard displayText={rowsName} headerTitle={title} launchForm={mayRecord ? record : undefined} />;
  }
  return (
    <div className={styles.card}>
      <CardHeader title={title}>
        <RecordFormButton form={form} label={actionLabel} opener={opener} />
      </CardHeader>
      {isLoading ? (
        <DataTableSkeleton
          role="progressbar"
          columnCount={columns.length}
          compact={desktop}
          showHeader={false}
          showToolbar={false}
        />
      ) : (
        <div className={styles.tableContainer}>
          <Table size={desktop ? 'sm' : 'lg'} aria-label={title}>
            <TableHead>
              <TableRow>
                {columns.map((column) => (
                  <TableHeader key={column.header}>{column.header}</TableHeader>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={rowKey(row)}>
                  {columns.map((column) => (
                    <TableCell key={column.header}>{column.text(row)}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
