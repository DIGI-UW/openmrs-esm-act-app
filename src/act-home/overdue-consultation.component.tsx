import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  DataTableSkeleton,
  InlineNotification,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
} from '@carbon/react';
import { formatDate, isDesktop, navigate, useLayoutType } from '@openmrs/esm-framework';
import { patientChartUrl } from '../patient-chart-url';
import { useRegistryReport } from '../registry/registry.resource';
import { type ReportRow } from '../reports/report-dataset.resource';
import { parseReportDate } from '../reports/report-date';
import { TableEmptyState } from '../table-filters/empty-state.component';
import { ActHomeCard } from './act-home-card.component';
import styles from './overdue-consultation.scss';

const DAY_MS = 24 * 60 * 60 * 1000;

interface Overdue {
  row: ReportRow;
  lastConsultation: Date | null;
  wasDue: Date;
  days: number;
}

/** The registry's patients whose next cardiology review date has passed, longest overdue first. */
export function overdueConsultations(rows: Array<ReportRow>, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return rows
    .map((row) => ({ row, wasDue: parseReportDate(row.next_consultation_date) }))
    .filter((entry): entry is { row: ReportRow; wasDue: Date } => !!entry.wasDue && entry.wasDue < today)
    .map(
      ({ row, wasDue }): Overdue => ({
        row,
        wasDue,
        lastConsultation: parseReportDate(row.last_consultation_date),
        days: Math.round((today.getTime() - wasDue.getTime()) / DAY_MS),
      }),
    )
    .sort((a, b) => b.days - a.days);
}

const date = (value: Date | null) => (value ? formatDate(value, { time: false, noToday: true }) : '');

/** ACT home's Overdue for consultation: the patients whose cardiology review date has passed, to open their charts. */
export default function OverdueConsultation() {
  const { t } = useTranslation();
  const desktop = isDesktop(useLayoutType());
  const { rows, isLoading, error } = useRegistryReport();
  const overdue = useMemo(() => overdueConsultations(rows), [rows]);
  const headers = [
    t('patient', 'Patient'),
    t('lastConsultation', 'Last consultation'),
    t('wasDue', 'Was due'),
    t('overdue', 'Overdue'),
  ];

  return (
    <ActHomeCard
      title={t('overdueForConsultation', 'Overdue for consultation')}
      tag={
        overdue.length ? (
          <Tag type="red">{t('patientCount', '{{count}} patients', { count: overdue.length })}</Tag>
        ) : null
      }
    >
      <p className={styles.description}>{t('cardiologyReviewDatePassed', 'Cardiology review date has passed')}</p>
      {error ? (
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title={t('couldNotLoadOverdueConsultations', 'Could not load the patients overdue for consultation')}
        />
      ) : isLoading ? (
        <DataTableSkeleton
          role="progressbar"
          columnCount={headers.length + 1}
          rowCount={3}
          compact={desktop}
          showHeader={false}
          showToolbar={false}
        />
      ) : !overdue.length ? (
        <TableEmptyState message={t('noOverdueConsultations', 'No patient is overdue for consultation')} />
      ) : (
        <div className={styles.tableContainer}>
          <Table size={desktop ? 'sm' : 'lg'}>
            <TableHead>
              <TableRow>
                {headers.map((header) => (
                  <TableHeader key={header}>{header}</TableHeader>
                ))}
                <TableHeader aria-label={t('actions', 'Actions')} />
              </TableRow>
            </TableHead>
            <TableBody>
              {overdue.map(({ row, lastConsultation, wasDue, days }) => (
                <TableRow key={String(row.patient_uuid)}>
                  <TableCell>
                    <span className={styles.name}>{String(row.full_name ?? '')}</span>
                    <span className={styles.actId}>{String(row.rhd_id ?? '')}</span>
                  </TableCell>
                  <TableCell>{date(lastConsultation)}</TableCell>
                  <TableCell>{date(wasDue)}</TableCell>
                  <TableCell className={styles.days}>{t('daysCount', '{{count}} days', { count: days })}</TableCell>
                  <TableCell>
                    <Button
                      kind="tertiary"
                      size="sm"
                      onClick={() => navigate({ to: patientChartUrl(row.patient_uuid) })}
                    >
                      {t('openChart', 'Open chart')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </ActHomeCard>
  );
}
