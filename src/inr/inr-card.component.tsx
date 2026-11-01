import React, { useState } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { Button, SkeletonText, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@carbon/react';
import {
  AddIcon,
  CardHeader,
  ChevronDownIcon,
  ChevronUpIcon,
  ConfigurableLink,
  formatDate,
} from '@openmrs/esm-framework';
import { EditButton } from '../cardiac-tests/cardiac-tests.component';
import { daysUntil } from '../patient-status/due-tone';
import InrChart, { inrTone } from './inr-chart.component';
import { useRecordInr } from './inr-reviews.component';
import { standardTarget, targetRange, useInrReviews, type InrReview } from './inr.resource';
import styles from '../styles/summary-card.scss';

const day = (date: Date) => formatDate(date, { time: false, noToday: true });
const readingsShown = 5;

/** The words for a reading: against its recorded target, else the 2.0 to 3.0 ACT 2.0 draws as its green zone. */
function useResultWord() {
  const { t } = useTranslation();
  return (review: InrReview) => {
    const [low, high] = targetRange(review.target) ?? standardTarget;
    return review.inr < low
      ? t('belowTarget', 'below target')
      : review.inr > high
        ? t('aboveTarget', 'above target')
        : t('inRangeWord', 'in range');
  };
}

/**
 * The patient summary's INR Monitoring section as ACT 2.0 shows it, for a patient on warfarin or with an INR: the
 * facts, the chart on its zones, and the readings, each with an Edit that opens beside the consultation.
 */
export default function InrCard({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const { reviews, onWarfarin, dose, nextInr, indication, isLoading } = useInrReviews(patientUuid);
  const record = useRecordInr(patientUuid);
  const resultWord = useResultWord();
  const [expanded, setExpanded] = useState(false);
  const readings = reviews.filter((review) => review.inr !== null);
  if (!isLoading && !onWarfarin && !readings.length) {
    return null;
  }
  const facts = [
    { id: 'indication', label: t('indication', 'Indication'), value: indication ?? '--' },
    { id: 'target', label: t('inrTarget', 'INR target'), value: reviews[0]?.target || '--' },
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
      <CardHeader title={t('inrMonitoring', 'INR Monitoring')}>
        <>
          {readings.length > 0 && (
            <Button
              kind="ghost"
              size="sm"
              aria-expanded={expanded}
              renderIcon={(props) =>
                expanded ? <ChevronUpIcon size={16} {...props} /> : <ChevronDownIcon size={16} {...props} />
              }
              onClick={() => setExpanded((open) => !open)}
            >
              {expanded ? t('hideReadings', 'Hide readings') : t('showReadings', 'Show readings')}
            </Button>
          )}
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
        </>
      </CardHeader>
      {isLoading ? (
        <SkeletonText paragraph lineCount={2} />
      ) : (
        <>
          <dl className={styles.fields}>
            {facts.map((fact) => (
              <div key={fact.id} className={styles.field}>
                <dt className={styles.label}>{fact.label}</dt>
                <dd
                  className={styles.value}
                  data-testid={`inr-${fact.id}`}
                  data-overdue={String(Boolean(fact.overdue))}
                >
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
          {readings.length ? (
            expanded && (
              <>
                <div className={styles.chart}>
                  <InrChart
                    readings={readings.map((review) => ({
                      date: review.date,
                      value: review.inr,
                      target: targetRange(review.target),
                    }))}
                  />
                </div>
                <Table size="sm" aria-label={t('inrMonitoring', 'INR Monitoring')}>
                  <TableHead>
                    <TableRow>
                      <TableHeader>{t('dateTested', 'Date tested')}</TableHeader>
                      <TableHeader>{t('inr', 'INR')}</TableHeader>
                      <TableHeader>{t('doseChange', 'Dose change')}</TableHeader>
                      {record?.edit && <TableHeader aria-label={t('edit', 'Edit')} />}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {readings.slice(0, readingsShown).map((review) => (
                      <TableRow key={review.key} data-testid="inr-reading">
                        <TableCell>{day(review.date)}</TableCell>
                        <TableCell>
                          <span
                            className={styles.dot}
                            data-testid="inr-tone"
                            data-tone={inrTone(review.inr, targetRange(review.target))}
                            aria-hidden
                          />
                          {t('inrWithResult', '{{inr}} · {{result}}', { inr: review.inr, result: resultWord(review) })}
                        </TableCell>
                        <TableCell>
                          {review.doseChange
                            ? review.newDose
                              ? t('doseChangedTo', '{{answer}}, {{dose}}', {
                                  answer: review.doseChange,
                                  dose: review.newDose,
                                })
                              : review.doseChange
                            : '--'}
                        </TableCell>
                        {record?.edit && (
                          <TableCell>
                            <EditButton
                              label={t('editInr', 'Edit INR of {{date}}', { date: day(review.date) })}
                              onClick={() => record.edit(review.encounterUuid, review.groupUuid)}
                            />
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {readings.length > readingsShown && (
                  <div className={styles.seeAll}>
                    <ConfigurableLink to={`\${openmrsSpaBase}/patient/${patientUuid}/chart/act-inr-reviews`}>
                      {t('seeAll', 'See all')}
                    </ConfigurableLink>
                  </div>
                )}
              </>
            )
          ) : (
            <p className={styles.note}>{t('inrChartEmpty', 'No INR recorded')}</p>
          )}
        </>
      )}
    </div>
  );
}
