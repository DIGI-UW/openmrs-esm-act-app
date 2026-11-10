import React from 'react';
import { useTranslation } from 'react-i18next';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tag } from '@carbon/react';
import { isDesktop, useLayoutType } from '@openmrs/esm-framework';
import { type ReportRow } from '../reports/report-dataset.resource';
import { adherence, type DueColumn, dueColumns, firstDoseDue, lowAdherence } from './due-list';
import { RecordDoseAction, type RecordDose } from './record-dose.component';
import { PatientCell } from '../patient-cell/patient-cell.component';
import styles from './due-for-prophylaxis.scss';

/** The due list's rows, each with the form that records its next dose, or View chart once recorded today. */
export function DueForProphylaxisTable({
  rows,
  recorded,
  recordDose: { opening, record },
}: {
  rows: Array<ReportRow>;
  recorded: Set<string>;
  recordDose: RecordDose;
}) {
  const { t } = useTranslation();
  const desktop = isDesktop(useLayoutType());

  // Drop the ACT ID column on screen only; PatientCell shows it and the CSV keeps it.
  const columns = dueColumns(t, recorded).filter((column) => column.key !== 'actId');

  /** A column's text, as the CSV holds it, with the chart link, the status tag and the adherence colour on screen. */
  const cell = (column: DueColumn, row: ReportRow) => {
    const text = column.text(row);
    if (column.key === 'patient') {
      return <PatientCell row={row} />;
    }
    if (!text) {
      return column.key === 'lastDose' ? t('noDoseYet', 'No dose yet') : '--';
    }
    if (column.key === 'status') {
      const recordedToday = recorded.has(String(row.patient_uuid));
      const firstDose = !recordedToday && firstDoseDue(row);
      const dueNow = !recordedToday && !firstDose && (row.status === 'due_today' || row.status === 'due_soon');
      return (
        <Tag
          type={recordedToday ? 'green' : row.status === 'overdue' ? 'red' : firstDose ? 'blue' : 'warm-gray'}
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
      <div className={desktop ? styles.tableContainer : `${styles.tableContainer} ${styles.tablet}`}>
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
                  <TableCell
                    key={column.key}
                    className={column.key === 'patient' || column.key === 'lastDose' ? styles.oneLine : undefined}
                  >
                    {cell(column, row)}
                  </TableCell>
                ))}
                <TableCell>
                  <RecordDoseAction
                    row={row}
                    recordedToday={recorded.has(String(row.patient_uuid))}
                    disabled={opening}
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
