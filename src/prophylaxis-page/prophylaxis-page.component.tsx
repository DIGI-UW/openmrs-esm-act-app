import React from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableSkeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tag } from '@carbon/react';
import {
  CardHeader,
  ErrorState,
  formatDate,
  isDesktop,
  parseDate,
  useConfig,
  useLayoutType,
} from '@openmrs/esm-framework';
import { useMayEnterForm } from '../access/may-enter-form';
import { EditButton } from '../cardiac-tests/cardiac-tests.component';
import { type Config } from '../config-schema';
import { useProphylaxisSummary } from '../prophylaxis/prophylaxis.resource';
import { TableEmptyState } from '../table-filters/empty-state.component';
import { useOpenFormInVisit } from '../visits/open-form-in-visit';
import { RecordProphylaxisButtons } from '../prophylaxis/record-prophylaxis-buttons.component';
import UpdateProphylaxis from '../prophylaxis/update-prophylaxis.component';
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

/** The leading section's actions, as the Prophylaxis card's: Update prophylaxis, then Record. */
function Actions({ patientUuid }: { patientUuid: string }) {
  return (
    <div className={cardStyles.actions}>
      <UpdateProphylaxis patientUuid={patientUuid} />
      <RecordProphylaxisButtons patientUuid={patientUuid} />
    </div>
  );
}

/** A dose's Edit, which reopens its encounter in the form that recorded it, for a user who may record that form. */
function useEditDose(patientUuid: string, form: string) {
  const mayEdit = useMayEnterForm(form);
  const { open, isOpening } = useOpenFormInVisit(patientUuid);
  return mayEdit ? { edit: (encounterUuid: string) => open(form, undefined, encounterUuid), isOpening } : null;
}

const day = (date: string) => formatDate(parseDate(date), { time: false, noToday: true });

interface SectionProps {
  patientUuid: string;
  /** Whether the section leads the page, carrying the actions and saying when it is empty. */
  leads: boolean;
}

function BpgInjections({ patientUuid, leads }: SectionProps) {
  const { t } = useTranslation();
  const desktop = isDesktop(useLayoutType());
  const { injections, error, isLoading } = useBpgInjections(patientUuid);
  const timingTag = useTimingTag(patientUuid);
  const editDose = useEditDose(patientUuid, useConfig<Config>().prophylaxisCard.bpgForm);
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
      columnCount={headers.length + Number(Boolean(editDose))}
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
          {editDose && <TableHeader aria-label={t('edit', 'Edit')} />}
        </TableRow>
      </TableHead>
      <TableBody>
        {injections.map((injection) => (
          <TableRow key={injection.uuid}>
            <TableCell>{day(injection.day)}</TableCell>
            <TableCell>{injection.dose ?? '--'}</TableCell>
            <TableCell>{injection.facility ?? injection.location ?? '--'}</TableCell>
            <TableCell>{timingTag(injection)}</TableCell>
            {editDose && (
              <TableCell>
                <EditButton
                  label={t('editBpgInjection', 'Edit BPG injection of {{date}}', {
                    date: day(injection.day),
                    interpolation: { escapeValue: false },
                  })}
                  disabled={editDose.isOpening}
                  onClick={() => editDose.edit(injection.uuid)}
                />
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div className={cardStyles.card}>
      <CardHeader title={title}>{leads && <Actions patientUuid={patientUuid} />}</CardHeader>
      {body}
    </div>
  );
}

/** Below 80% is where the oral form asks why adherence is low. */
const LOW_ADHERENCE = 80;

function OralEntries({ patientUuid, leads }: SectionProps) {
  const { t } = useTranslation();
  const desktop = isDesktop(useLayoutType());
  const { entries, error, isLoading } = useOralEntries(patientUuid);
  const editDose = useEditDose(patientUuid, useConfig<Config>().prophylaxisCard.oralForm);
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
      columnCount={headers.length + Number(Boolean(editDose))}
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
          {editDose && <TableHeader aria-label={t('edit', 'Edit')} />}
        </TableRow>
      </TableHead>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.uuid}>
            <TableCell>{day(entry.date)}</TableCell>
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
            <TableCell>{entry.basedOn.length ? entry.basedOn.join(', ') : '--'}</TableCell>
            <TableCell>{entry.lowAdherenceReason ?? '--'}</TableCell>
            <TableCell>{entry.newPrescription ?? '--'}</TableCell>
            {editDose && (
              <TableCell>
                <EditButton
                  label={t('editOralReport', 'Edit oral adherence report of {{date}}', {
                    date: day(entry.date),
                    interpolation: { escapeValue: false },
                  })}
                  disabled={editDose.isOpening}
                  onClick={() => editDose.edit(entry.uuid)}
                />
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div className={cardStyles.card}>
      <CardHeader title={title}>{leads && <Actions patientUuid={patientUuid} />}</CardHeader>
      {body}
    </div>
  );
}

/** The prescribed type's history leads, with Update prophylaxis and the Record actions; the other shows only when it has entries. */
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
