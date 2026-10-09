import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  InlineNotification,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
} from '@carbon/react';
import { ConfigurableLink, isDesktop, useConfig, useLayoutType, useSession } from '@openmrs/esm-framework';
import { MayEnterForm } from '../access/may-enter-form';
import { type Config } from '../config-schema';
import { patientChartUrl } from '../patient-chart-url';
import { type ReportRow } from '../reports/report-dataset.resource';
import { openFormInChart } from '../visits/open-form-in-chart';
import { adherence, isOral, lastDose, lowAdherence, prescription, statusLabel } from './due-list';
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
    const recordedToday = recorded.has(String(row.patient_uuid));
    const dueNow = !recordedToday && row.status !== 'overdue';
    return (
      <Tag type={recordedToday ? 'green' : dueNow ? 'warm-gray' : 'red'} className={dueNow ? styles.dueTag : undefined}>
        {statusLabel(t, row, recordedToday)}
      </Tag>
    );
  };

  const adherenceCell = (row: ReportRow) => {
    const percent = adherence(row);
    if (percent === null) {
      return '';
    }
    return <span className={lowAdherence(percent) ? styles.lowAdherence : styles.goodAdherence}>{`${percent}%`}</span>;
  };

  const action = (row: ReportRow) => {
    if (recorded.has(String(row.patient_uuid))) {
      return <ConfigurableLink to={patientChartUrl(row.patient_uuid)}>{t('viewChart', 'View chart')}</ConfigurableLink>;
    }
    const oral = isOral(row);
    const form = oral ? prophylaxisCard.oralForm : prophylaxisCard.bpgForm;
    return (
      <MayEnterForm formUuid={form}>
        <Button kind="primary" size="sm" disabled={opening || checking} onClick={() => record(row, form)}>
          {oral ? t('recordOral', 'Record oral') : t('recordBpg', 'Record BPG')}
        </Button>
      </MayEnterForm>
    );
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
              <TableHeader>{t('patient', 'Patient')}</TableHeader>
              <TableHeader>{t('actId', 'ACT ID')}</TableHeader>
              <TableHeader>{t('prescription', 'Prescription')}</TableHeader>
              <TableHeader>{t('lastDose', 'Last dose')}</TableHeader>
              <TableHeader>{t('status', 'Status')}</TableHeader>
              <TableHeader>{t('adherence', 'Adherence')}</TableHeader>
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
                <TableCell>{prescription(t, row)}</TableCell>
                <TableCell>{lastDose(row)}</TableCell>
                <TableCell>{status(row)}</TableCell>
                <TableCell>{adherenceCell(row)}</TableCell>
                <TableCell>{action(row)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
