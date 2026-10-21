import React from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { Button, SkeletonText } from '@carbon/react';
import { AddIcon, CardHeader, formatDate } from '@openmrs/esm-framework';
import { daysUntil } from '../patient-status/due-tone';
import { useRecordInr } from './inr-reviews.component';
import { useInrReviews } from './inr.resource';
import styles from '../styles/summary-card.scss';

const day = (date: Date) => formatDate(date, { time: false, noToday: true });

/**
 * The patient summary's INR review card, for a patient on warfarin only, as the prototype's: the last INR and its
 * date, the target range, the next INR due (red once overdue) and the warfarin dose.
 */
export default function InrCard({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const { reviews, onWarfarin, dose, nextInr, isLoading } = useInrReviews(patientUuid);
  const record = useRecordInr(patientUuid);
  if (!isLoading && !onWarfarin) {
    return null;
  }
  const last = reviews.find((review) => review.inr !== null);
  const fields = [
    {
      id: 'last',
      label: t('lastInr', 'Last INR'),
      value: last ? t('inrOnDate', '{{inr}} · {{date}}', { inr: last.inr, date: day(last.date) }) : '--',
    },
    { id: 'target', label: t('targetRange', 'Target range'), value: reviews[0]?.target || '--' },
    {
      id: 'next',
      label: t('nextInrDue', 'Next INR due'),
      value: nextInr ? day(nextInr) : '--',
      overdue: Boolean(nextInr) && daysUntil(dayjs(nextInr).format('YYYY-MM-DD')) < 0,
    },
    { id: 'dose', label: t('warfarinDose', 'Warfarin dose'), value: dose || '--' },
  ];
  return (
    <div className={styles.card}>
      <CardHeader title={t('inrReview', 'INR review')}>
        {record && (
          <Button
            kind="ghost"
            size="sm"
            renderIcon={(props) => <AddIcon size={16} {...props} />}
            disabled={record.isOpening}
            onClick={record.record}
          >
            {t('recordInr', 'Record INR')}
          </Button>
        )}
      </CardHeader>
      {isLoading ? (
        <SkeletonText paragraph lineCount={2} />
      ) : (
        <dl className={styles.fields}>
          {fields.map((field) => (
            <div key={field.id} className={styles.field}>
              <dt className={styles.label}>{field.label}</dt>
              <dd
                className={styles.value}
                data-testid={`inr-${field.id}`}
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
