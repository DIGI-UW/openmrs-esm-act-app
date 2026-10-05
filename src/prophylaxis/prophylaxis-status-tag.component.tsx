import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Tag } from '@carbon/react';
import { formatDate, parseDate, showSnackbar } from '@openmrs/esm-framework';
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

/** The patient banner's Overdue or Due today tag; up to date, unknown, unreadable or deceased shows none. */
export default function ProphylaxisStatusTag({ patientUuid, patient }: ProphylaxisStatusTagProps) {
  const { t } = useTranslation();
  const deceased = Boolean(patient?.deceasedBoolean || patient?.deceasedDateTime);
  const { summary } = useProphylaxisSummary(deceased ? null : patientUuid);
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
  return null;
}
