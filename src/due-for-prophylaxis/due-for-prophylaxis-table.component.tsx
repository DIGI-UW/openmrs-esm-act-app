import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tag } from '@carbon/react';
import { ConfigurableLink, formatDate, isDesktop, useConfig, useLayoutType, useSession } from '@openmrs/esm-framework';
import { MayEnterForm } from '../access/may-enter-form';
import { type Config } from '../config-schema';
import { patientChartUrl } from '../patient-chart-url';
import { type ReportRow } from '../reports/report-dataset.resource';
import { parseReportDate } from '../reports/report-date';
import { openFormInChart } from '../visits/open-form-in-chart';
import styles from './due-for-prophylaxis.scss';

function lastDose(row: ReportRow) {
  const date = parseReportDate(row.last_given);
  return date ? formatDate(date, { time: false, noToday: true }) : '';
}

/** The due list's rows, each with the form that records its next dose, or View chart once recorded today. */
export function DueForProphylaxisTable({ rows, recorded }: { rows: Array<ReportRow>; recorded: Set<string> }) {
  const { t } = useTranslation();
  const { prophylaxisCard, visitType } = useConfig<Config>();
  const { sessionLocation } = useSession();
  const desktop = isDesktop(useLayoutType());
  // One form at a time, as a second click while a visit is starting would start a second visit.
  const [opening, setOpening] = useState(false);

  const record = async (row: ReportRow, formUuid: string) => {
    setOpening(true);
    try {
      await openFormInChart(t, {
        patientUuid: String(row.patient_uuid),
        formUuid,
        visitType,
        location: sessionLocation?.uuid,
      });
    } finally {
      setOpening(false);
    }
  };

  const status = (row: ReportRow) => {
    if (recorded.has(String(row.patient_uuid))) {
      return <Tag type="green">{t('recordedToday', 'Recorded today')}</Tag>;
    }
    return row.status === 'due_today' ? (
      <Tag type="blue">{t('dueToday', 'Due today')}</Tag>
    ) : (
      <Tag type="red">{t('overdue', 'Overdue')}</Tag>
    );
  };

  const action = (row: ReportRow) => {
    if (recorded.has(String(row.patient_uuid))) {
      return <ConfigurableLink to={patientChartUrl(row.patient_uuid)}>{t('viewChart', 'View chart')}</ConfigurableLink>;
    }
    const oral = row.prophylaxis_type === 'Oral';
    const form = oral ? prophylaxisCard.oralForm : prophylaxisCard.bpgForm;
    return (
      <MayEnterForm formUuid={form}>
        <Button kind="primary" size="sm" disabled={opening} onClick={() => record(row, form)}>
          {oral ? t('recordOral', 'Record oral') : t('recordBpg', 'Record BPG')}
        </Button>
      </MayEnterForm>
    );
  };

  return (
    <div className={styles.tableContainer}>
      <Table size={desktop ? 'sm' : 'lg'} useZebraStyles>
        <TableHead>
          <TableRow>
            <TableHeader>{t('name', 'Name')}</TableHeader>
            <TableHeader>{t('actId', 'ACT ID')}</TableHeader>
            <TableHeader>{t('prophylaxisType', 'Type')}</TableHeader>
            <TableHeader>{t('lastDose', 'Last dose')}</TableHeader>
            <TableHeader>{t('status', 'Status')}</TableHeader>
            <TableHeader aria-label={t('actions', 'Actions')} />
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={String(row.patient_uuid)}>
              <TableCell>
                <ConfigurableLink to={patientChartUrl(row.patient_uuid)}>
                  {String(row.full_name ?? '')}
                </ConfigurableLink>
              </TableCell>
              <TableCell>{String(row.rhd_id ?? '')}</TableCell>
              <TableCell>{String(row.prophylaxis_type ?? '')}</TableCell>
              <TableCell>{lastDose(row)}</TableCell>
              <TableCell>{status(row)}</TableCell>
              <TableCell>{action(row)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
