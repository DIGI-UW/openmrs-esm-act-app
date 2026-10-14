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

interface SectionProps {
  patientUuid: string;
  /** Whether the section leads the page, carrying the Record actions and saying when it is empty. */
  leads: boolean;
}

function BpgInjections({ patientUuid, leads }: SectionProps) {
  const { t } = useTranslation();
  const desktop = isDesktop(useLayoutType());
  const { injections, error, isLoading } = useBpgInjections(patientUuid);
  const timingTag = useTimingTag(patientUuid);
  const title = t('bpgInjections', 'BPG injections');
  const headers = [t('date', 'Date'), t('given', 'Given'), t('facility', 'Facility'), t('notes', 'Notes')];

  if (error) {
    return <ErrorState error={error} headerTitle={title} />;
  }
  if (!leads && !injections.length) {
    return null;
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
            <TableCell>{injection.dose ?? '--'}</TableCell>
            <TableCell>{injection.facility ?? injection.location ?? '--'}</TableCell>
            <TableCell>{timingTag(injection)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div className={cardStyles.card}>
      <CardHeader title={title}>{leads && <RecordProphylaxisButtons patientUuid={patientUuid} />}</CardHeader>
      {body}
    </div>
  );
}

/** Below 80% is where the oral form asks why and ACT Core suggests reviewing the regimen. */
const LOW_ADHERENCE = 80;

function OralEntries({ patientUuid, leads }: SectionProps) {
  const { t } = useTranslation();
  const desktop = isDesktop(useLayoutType());
  const { entries, error, isLoading } = useOralEntries(patientUuid);
  const title = t('oralAdherence', 'Oral adherence');
  const headers = [
    t('date', 'Date'),
    t('adherence', 'Adherence'),
    t('basedOn', 'Based on'),
    t('reasonBelow80', 'Reason if below 80%'),
    t('newPrescription', 'New prescription'),
  ];

  if (error) {
    return <ErrorState error={error} headerTitle={title} />;
  }
  if (!leads && !entries.length) {
    return null;
  }
  const body = isLoading ? (
    <DataTableSkeleton
      role="progressbar"
      columnCount={headers.length}
      compact={desktop}
      showHeader={false}
      showToolbar={false}
    />
  ) : !entries.length ? (
    <TableEmptyState message={t('noOralReports', 'There are no oral adherence reports to display')} />
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
        {entries.map((entry) => (
          <TableRow key={entry.uuid}>
            <TableCell>{formatDate(parseDate(entry.date), { time: false, noToday: true })}</TableCell>
            <TableCell>
              {entry.adherence == null ? (
                '--'
              ) : entry.adherence < LOW_ADHERENCE ? (
                <Tag type="red" size="sm" data-testid="low-adherence">
                  {`${entry.adherence}%`}
                </Tag>
              ) : (
                `${entry.adherence}%`
              )}
            </TableCell>
            <TableCell>{entry.basedOn ?? '--'}</TableCell>
            <TableCell>{entry.lowAdherenceReason ?? '--'}</TableCell>
            <TableCell>{entry.newPrescription ?? '--'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div className={cardStyles.card}>
      <CardHeader title={title}>{leads && <RecordProphylaxisButtons patientUuid={patientUuid} />}</CardHeader>
      {body}
    </div>
  );
}

/** The prescribed type's history leads, with the Record actions; the other shows only when it has entries. */
export default function ProphylaxisPage({ patientUuid }: { patientUuid: string }) {
  const oral = useProphylaxisSummary(patientUuid).summary?.type === 'Oral';
  return oral ? (
    <>
      <OralEntries patientUuid={patientUuid} leads />
      <BpgInjections patientUuid={patientUuid} leads={false} />
    </>
  ) : (
    <>
      <BpgInjections patientUuid={patientUuid} leads />
      <OralEntries patientUuid={patientUuid} leads={false} />
    </>
  );
}
