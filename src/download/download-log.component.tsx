import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTableSkeleton,
  InlineNotification,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { formatDatetime, isDesktop, PatientListsPictogram, useLayoutType } from '@openmrs/esm-framework';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import { TableEmptyState } from '../table-filters/empty-state.component';
import { type DownloadLogDetail, useDownloadLog } from './download.resource';
import styles from './download.scss';

/**
 * ACT 2.0's download entries of its user logs: who downloaded which form's fields, when, over which dates and with
 * or without identifiers. The audit log module has no place for them, so ACT Core keeps them.
 */
export default function DownloadLog() {
  const { t } = useTranslation();
  const desktop = isDesktop(useLayoutType());
  const { entries, error, isLoading } = useDownloadLog();

  const period = (detail: DownloadLogDetail) =>
    detail.startDate || detail.endDate
      ? t('downloadPeriod', '{{from}} to {{to}}', { from: detail.startDate ?? '...', to: detail.endDate ?? '...' })
      : t('allDates', 'All dates');

  const kind = (detail: DownloadLogDetail) =>
    detail.identifiers
      ? t('withIdentifiers', 'With identifiers')
      : detail.researchOnly
        ? t('researchParticipantsWithoutIdentifiers', 'Research participants, without identifiers')
        : t('withoutIdentifiers', 'Without identifiers');

  let body: React.ReactNode;
  if (error) {
    body = (
      <InlineNotification
        kind="error"
        lowContrast
        hideCloseButton
        title={t('couldNotLoadDownloads', 'Could not load the downloads')}
        subtitle={error.message}
      />
    );
  } else if (isLoading) {
    body = (
      <DataTableSkeleton role="progressbar" columnCount={7} compact={desktop} showHeader={false} showToolbar={false} />
    );
  } else if (!entries.length) {
    body = <TableEmptyState message={t('noDownloads', 'There are no downloads to display')} />;
  } else {
    body = (
      <div className={styles.tableContainer}>
        <Table aria-label={t('downloadLog', 'Download log')} size={desktop ? 'sm' : 'lg'} useZebraStyles>
          <TableHead>
            <TableRow>
              <TableHeader>{t('time', 'Time')}</TableHeader>
              <TableHeader>{t('user', 'User')}</TableHeader>
              <TableHeader>{t('form', 'Form')}</TableHeader>
              <TableHeader>{t('fields', 'Fields')}</TableHeader>
              <TableHeader>{t('period', 'Period')}</TableHeader>
              <TableHeader>{t('rows', 'Rows')}</TableHeader>
              <TableHeader>{t('identifiers', 'Identifiers')}</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {entries.map((entry, index) => (
              <TableRow key={`${entry.date}-${index}`}>
                <TableCell>{formatDatetime(new Date(entry.date))}</TableCell>
                <TableCell>{entry.user.username}</TableCell>
                <TableCell>{entry.form?.name ?? ''}</TableCell>
                <TableCell>{entry.detail?.fields.join(', ') ?? ''}</TableCell>
                <TableCell>{entry.detail ? period(entry.detail) : ''}</TableCell>
                <TableCell>{entry.detail?.rows ?? ''}</TableCell>
                <TableCell>{entry.detail ? kind(entry.detail) : ''}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <>
      <ActPageHeader title={t('downloadLog', 'Download log')} illustration={<PatientListsPictogram />} />
      <div className={styles.logPage}>
        <p className={styles.explanation}>
          {t('downloadLogExplanation', "Everyone's latest downloads of forms' fields, newest first.")}
        </p>
        {body}
      </div>
    </>
  );
}
