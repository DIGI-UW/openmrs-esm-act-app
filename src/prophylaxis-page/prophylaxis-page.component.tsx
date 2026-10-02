import React from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableSkeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tag } from '@carbon/react';
import { CardHeader, ErrorState, formatDate, isDesktop, parseDate, useLayoutType } from '@openmrs/esm-framework';
import { useProphylaxisSummary } from '../prophylaxis/prophylaxis.resource';
import { TableEmptyState } from '../table-filters/empty-state.component';
import { RecordProphylaxisButtons } from '../prophylaxis/record-prophylaxis-buttons.component';
import { type BpgInjection, useBpgInjections, useOralEntries } from './prophylaxis-page.resource';
import cardStyles from '../styles/summary-card.scss';
import styles from './prophylaxis-page.scss';

function useTimingTag(patientUuid: string) {
  const { t } = useTranslation();
  const { summary } = useProphylaxisSummary(patientUuid);
  const onTimeByDay = new Map((summary?.injections ?? []).map((injection) => [injection.date, injection.onTime]));
  return (injection: BpgInjection) => {
    const onTime = onTimeByDay.get(injection.day);
    if (onTime === true) {
      return (
        <Tag type="green" size="sm" data-testid="timing-tag">
          {t('onTime', 'On time')}
        </Tag>
      );
    }
    if (onTime === false) {
      const late = t('late', 'Late');
      return (
        <Tag size="sm" className={styles.late} data-late="true" data-testid="timing-tag">
          {injection.lateReasons.length ? `${late} · ${injection.lateReasons.join(', ')}` : late}
        </Tag>
      );
    }
    return null;
  };
}

function BpgInjections({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const desktop = isDesktop(useLayoutType());
  const { injections, error, isLoading } = useBpgInjections(patientUuid);
  const timingTag = useTimingTag(patientUuid);
  const title = t('bpgInjections', 'BPG injections');
  const headers = [t('date', 'Date'), t('facility', 'Facility'), t('notes', 'Notes')];

  if (error) {
    return <ErrorState error={error} headerTitle={title} />;
  }
  const body = isLoading ? (
    <DataTableSkeleton
      role="progressbar"
      columnCount={headers.length}
      compact={desktop}
      showHeader={false}
      showToolbar={false}
    />
  ) : !injections.length ? (
    <TableEmptyState message={t('noBpgInjections', 'There are no BPG injections to display')} />
  ) : (
    <Table aria-label={title} size={desktop ? 'sm' : 'lg'}>
      <TableHead>
        <TableRow>
          {headers.map((header) => (
            <TableHeader key={header}>{header}</TableHeader>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {injections.map((injection) => (
          <TableRow key={injection.uuid}>
            <TableCell>{formatDate(parseDate(injection.day), { time: false, noToday: true })}</TableCell>
            <TableCell>{injection.facility ?? injection.location ?? '--'}</TableCell>
            <TableCell>{timingTag(injection)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div className={cardStyles.card}>
      <CardHeader title={title}>
        <RecordProphylaxisButtons patientUuid={patientUuid} />
      </CardHeader>
      {body}
    </div>
  );
}

function OralEntries({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const desktop = isDesktop(useLayoutType());
  const { entries, error } = useOralEntries(patientUuid);
  const title = t('oralAdherence', 'Oral adherence');

  if (error) {
    return <ErrorState error={error} headerTitle={title} />;
  }
  if (!entries.length) {
    return null;
  }
  return (
    <div className={cardStyles.card}>
      <CardHeader title={title} />
      <Table aria-label={title} size={desktop ? 'sm' : 'lg'}>
        <TableHead>
          <TableRow>
            {[t('date', 'Date'), t('period', 'Period'), t('adherence', 'Adherence')].map((header) => (
              <TableHeader key={header}>{header}</TableHeader>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.uuid}>
              <TableCell>{formatDate(parseDate(entry.date), { time: false, noToday: true })}</TableCell>
              <TableCell>
                {entry.weeks == null ? '--' : t('weeksCount', '{{count}} weeks', { count: entry.weeks })}
              </TableCell>
              <TableCell>{entry.adherence == null ? '--' : `${entry.adherence}%`}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function ProphylaxisPage({ patientUuid }: { patientUuid: string }) {
  return (
    <>
      <BpgInjections patientUuid={patientUuid} />
      <OralEntries patientUuid={patientUuid} />
    </>
  );
}
