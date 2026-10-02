import React from 'react';
import { useTranslation } from 'react-i18next';
import { SkeletonText } from '@carbon/react';
import { CardHeader, formatDate, parseDate } from '@openmrs/esm-framework';
import { RecordProphylaxisButtons } from './record-prophylaxis-buttons.component';
import { type ProphylaxisSummary, useProphylaxisSummary } from './prophylaxis.resource';
import styles from '../styles/summary-card.scss';

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
  const { summary, error } = useProphylaxisSummary(patientUuid);
  const regimenLabel = useRegimenLabel();

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
        <RecordProphylaxisButtons patientUuid={patientUuid} />
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
