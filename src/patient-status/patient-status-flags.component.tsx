import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate, parseDate, showSnackbar } from '@openmrs/esm-framework';
import { type ProphylaxisSummary, useProphylaxisSummary } from '../prophylaxis/prophylaxis.resource';
import { useNextCardiologyVisit } from './cardiology.resource';
import { pillsClassName } from './status-pill.component';
import { CardiologyPill, ProphylaxisPill } from './status-pills.component';

interface PatientStatusFlagsProps {
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

/** The patient banner's prophylaxis and cardiology visit pills; a deceased patient, or one with neither date, shows none. */
export default function PatientStatusFlags({ patientUuid, patient }: PatientStatusFlagsProps) {
  const deceased = Boolean(patient?.deceasedBoolean || patient?.deceasedDateTime);
  const { summary } = useProphylaxisSummary(deceased ? null : patientUuid);
  const { nextDue } = useNextCardiologyVisit(deceased ? null : patientUuid);
  useNextDueSnackbar(summary);

  if (deceased) {
    return null;
  }
  return (
    <span className={pillsClassName}>
      <ProphylaxisPill summary={summary} />
      <CardiologyPill nextDue={nextDue} />
    </span>
  );
}
