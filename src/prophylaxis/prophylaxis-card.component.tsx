import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, SkeletonText } from '@carbon/react';
import { AddIcon, CardHeader, formatDate, parseDate, useConfig, useVisit } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { useOpenFormInVisit } from '../visits/open-form-in-visit';
import { type ProphylaxisSummary, useProphylaxisSummary } from './prophylaxis.resource';
import styles from './prophylaxis-card.scss';

interface ProphylaxisCardProps {
  patientUuid: string;
}

function useRegimenLabel() {
  const { t } = useTranslation();
  return (summary: ProphylaxisSummary) => {
    if (summary.type === 'Oral') {
      return t('oral', 'Oral');
    }
    if (summary.type !== 'BPG' || !summary.intervalDays) {
      return t('noPrescription', 'No prescription');
    }
    return summary.intervalDays % 7 === 0
      ? t('bpgEveryWeeks', 'BPG · every {{weeks}} weeks', { weeks: summary.intervalDays / 7 })
      : t('bpgEveryDays', 'BPG · every {{days}} days', { days: summary.intervalDays });
  };
}

const date = (value: string | null) => (value ? formatDate(parseDate(value), { time: false }) : '--');

/** The patient summary's prophylaxis: regimen, last and next dose, on-time count, and the forms to record a dose. */
export default function ProphylaxisCard({ patientUuid }: ProphylaxisCardProps) {
  const { t } = useTranslation();
  const { prophylaxisCard } = useConfig<Config>();
  const { summary, error, mutate } = useProphylaxisSummary(patientUuid);
  const { open: openForm, isOpening } = useOpenFormInVisit(patientUuid);
  const regimenLabel = useRegimenLabel();

  // A saved form revalidates the visit, so a new encounter in it means the summary may have moved.
  const { activeVisit, isLoading: visitLoading } = useVisit(patientUuid);
  const encounters = activeVisit?.encounters?.length ?? 0;
  // Unset until the visit has loaded, so loading it is not taken for a save.
  const seenEncounters = useRef<number | null>(null);
  useEffect(() => {
    if (visitLoading) {
      return;
    }
    if (seenEncounters.current !== null && encounters !== seenEncounters.current) {
      mutate();
    }
    seenEncounters.current = encounters;
  }, [encounters, mutate, visitLoading]);

  if (error) {
    return null;
  }

  const fields = summary && [
    { id: 'type', label: t('type', 'Type'), value: regimenLabel(summary) },
    { id: 'last-dose', label: t('lastDose', 'Last dose'), value: date(summary.lastGiven) },
    {
      id: 'next-due',
      label: t('nextDue', 'Next due'),
      value: date(summary.nextDue),
      overdue: summary.status === 'overdue',
    },
    {
      id: 'on-time',
      label: t('onTimeSixMonths', 'On-time (6 months)'),
      value: summary.onTime
        ? t('onTimeCount', '{{given}} of {{total}}', { given: summary.onTime.given, total: summary.onTime.total })
        : '--',
    },
  ];

  return (
    <div className={styles.card}>
      <CardHeader title={t('prophylaxis', 'Prophylaxis')}>
        <div className={styles.actions}>
          <Button
            kind="ghost"
            size="sm"
            renderIcon={(props) => <AddIcon size={16} {...props} />}
            disabled={isOpening}
            onClick={() => openForm(prophylaxisCard.bpgForm)}
          >
            {t('recordBpg', 'Record BPG')}
          </Button>
          <Button
            kind="ghost"
            size="sm"
            renderIcon={(props) => <AddIcon size={16} {...props} />}
            disabled={isOpening}
            onClick={() => openForm(prophylaxisCard.oralForm)}
          >
            {t('recordOral', 'Record oral')}
          </Button>
        </div>
      </CardHeader>
      {!fields ? (
        <div data-testid="prophylaxis-loading">
          <SkeletonText paragraph lineCount={2} />
        </div>
      ) : (
        <dl className={styles.fields}>
          {fields.map((field) => (
            <div key={field.id} className={styles.field}>
              <dt className={styles.label}>{field.label}</dt>
              <dd
                className={styles.value}
                data-testid={`prophylaxis-${field.id}`}
                data-overdue={String(Boolean(field.overdue))}
              >
                {field.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
