import React, { useEffect, useRef } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { Tag } from '@carbon/react';
import { formatDate, parseDate, showSnackbar } from '@openmrs/esm-framework';
import { isDeceased } from '../deceased';
import { statusLabel } from '../due-for-prophylaxis/due-list';
import { dueStatus } from '../enter-prophylaxis/patients-on-prophylaxis';
import { type ProphylaxisSummary, useProphylaxisSummary } from './prophylaxis.resource';

interface ProphylaxisStatusTagProps {
  patientUuid: string;
  patient?: fhir.Patient;
}

/** After a BPG dose is saved, the date the next one is due, as the summary reads it again on every save. */
function useNextDueSnackbar(summary: ProphylaxisSummary | undefined) {
  const { t } = useTranslation();
  // undefined until the first summary arrives, so the dose already on record when the chart opens shows nothing.
  const lastSeen = useRef<string | null | undefined>(undefined);
  const lastGiven = summary?.lastGiven ?? null;

  useEffect(() => {
    if (!summary) {
      return;
    }
    const newerDose =
      lastSeen.current !== undefined && lastGiven && (!lastSeen.current || lastGiven > lastSeen.current);
    if (newerDose && summary.type === 'BPG') {
      showSnackbar({
        kind: 'success',
        isLowContrast: true,
        title: t('bpgDoseRecorded', 'BPG dose recorded'),
        subtitle: summary.nextDue
          ? t('nextDueOn', 'Next due {{date}}', { date: formatDate(parseDate(summary.nextDue), { time: false }) })
          : undefined,
      });
    }
    lastSeen.current = lastGiven;
  }, [summary, lastGiven, t]);
}

const colours = { due_soon: 'purple', up_to_date: 'green' } as const;

/**
 * The patient banner's prophylaxis tag: Overdue or Due today as ACT Core says, else Due in 48 h or Up to date by the
 * days to the next dose, as the due list counts them. No prescription, an unknown due date, an unreadable summary or a
 * deceased patient shows none, nor does a dose ACT Core has not yet called due whose date the browser's clock, in
 * another time zone, already counts as today or past.
 */
export default function ProphylaxisStatusTag({ patientUuid, patient }: ProphylaxisStatusTagProps) {
  const { t } = useTranslation();
  const { summary } = useProphylaxisSummary(isDeceased(patient) ? null : patientUuid);
  useNextDueSnackbar(summary);

  if (summary?.status === 'overdue') {
    return (
      <Tag data-testid="prophylaxis-status" type="red">
        {t('overdue', 'Overdue')}
      </Tag>
    );
  }
  if (summary?.status === 'dueToday') {
    return (
      <Tag data-testid="prophylaxis-status" type="blue">
        {t('dueToday', 'Due today')}
      </Tag>
    );
  }
  if ((summary?.status === 'dueSoon' || summary?.status === 'ok') && summary.nextDue) {
    const status = dueStatus(dayjs(summary.nextDue).diff(dayjs().startOf('day'), 'day'));
    if (status === 'due_soon' || status === 'up_to_date') {
      return (
        <Tag data-testid="prophylaxis-status" type={colours[status]}>
          {statusLabel(t, { status }, false)}
        </Tag>
      );
    }
  }
  return null;
}
