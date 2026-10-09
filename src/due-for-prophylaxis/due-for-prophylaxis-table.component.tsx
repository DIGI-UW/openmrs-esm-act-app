import React from 'react';
import { useTranslation } from 'react-i18next';
import { InlineNotification, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tag } from '@carbon/react';
import { ConfigurableLink, isDesktop, useLayoutType } from '@openmrs/esm-framework';
import { patientChartUrl } from '../patient-chart-url';
import { type ReportRow } from '../reports/report-dataset.resource';
import { adherence, type DueColumn, dueColumns, lowAdherence } from './due-list';
import { RecordDoseAction, useRecordDose } from './record-dose.component';
import styles from './due-for-prophylaxis.scss';

/**
 * The due list's rows, each with the form that records its next dose, or View chart once recorded today. Record waits
 * while `checking`, as a cached answer may predate a dose just recorded.
 */
export function DueForProphylaxisTable({
  rows,
  recorded,
  recordedError,
  checking,
}: {
  rows: Array<ReportRow>;
  recorded: Set<string>;
  recordedError?: Error;
  checking?: boolean;
}) {
  const { t } = useTranslation();
  const desktop = isDesktop(useLayoutType());
  const { opening, record } = useRecordDose();

  const columns = dueColumns(t, recorded);

  /** A column's text, as the CSV holds it, with the chart link, the status tag and the adherence colour on screen. */
  const cell = (column: DueColumn, row: ReportRow) => {
    const text = column.text(row);
    if (column.key === 'patient') {
      return <ConfigurableLink to={patientChartUrl(row.patient_uuid)}>{text}</ConfigurableLink>;
    }
    if (column.key === 'status') {
      if (!text) {
        return null;
      }
      const recordedToday = recorded.has(String(row.patient_uuid));
      const dueNow = !recordedToday && (row.status === 'due_today' || row.status === 'due_soon');
      return (
        <Tag
          type={recordedToday ? 'green' : row.status === 'overdue' ? 'red' : 'warm-gray'}
          className={dueNow ? styles.dueTag : undefined}
        >
          {text}
        </Tag>
      );
    }
    const percent = adherence(row);
    if (column.key === 'adherence' && percent !== null) {
      return <span className={lowAdherence(percent) ? styles.lowAdherence : styles.goodAdherence}>{text}</span>;
    }
    return text;
  };

  return (
    <>
      {recordedError && (
        <InlineNotification
          kind="warning"
          lowContrast
          hideCloseButton
          title={t('couldNotCheckRecordedToday', 'Could not check who was recorded today')}
          subtitle={t(
            'recordedTodayUnknown',
            'A patient already recorded today may still show Record. Open their chart before recording.',
          )}
        />
      )}
      <div className={styles.tableContainer}>
        <Table size={desktop ? 'sm' : 'lg'} useZebraStyles>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableHeader key={column.key}>{column.header}</TableHeader>
              ))}
              <TableHeader aria-label={t('actions', 'Actions')} />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={String(row.patient_uuid)}>
                {columns.map((column) => (
                  <TableCell key={column.key}>{cell(column, row)}</TableCell>
                ))}
                <TableCell>
                  <RecordDoseAction
                    row={row}
                    recordedToday={recorded.has(String(row.patient_uuid))}
                    disabled={opening || checking}
                    onRecord={record}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
