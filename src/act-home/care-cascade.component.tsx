import React, { useMemo } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { InlineNotification, SkeletonText } from '@carbon/react';
import { formatDate, toOmrsIsoString, useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { ScreenAccess } from '../access/screen-access.component';
import { useReportDataset } from '../reports/report-dataset.resource';
import { ActHomeCard } from './act-home-card.component';
import ScreenPositiveRow from './screen-positive-count.component';
import styles from './care-cascade.scss';

function Cascade() {
  const { t } = useTranslation();
  const { careCascade } = useConfig<Config>();
  // The reports app runs a date as that day's midnight, so the counts match the report run for today.
  const today = useMemo(() => dayjs().startOf('day'), []);
  const { rows, isLoading, error } = useReportDataset(careCascade.report, { endDate: toOmrsIsoString(today.toDate()) });
  // The cascade descriptor names its columns step and patients, one row per step.
  const byStep = new Map(rows.map((row) => [String(row.step), Number(row.patients)]));
  const steps = careCascade.steps
    .filter(({ step }) => byStep.has(step))
    .map(({ step, label }) => ({ step, label, patients: byStep.get(step) }));
  const largest = Math.max(0, ...steps.map((row) => row.patients));

  return (
    <ActHomeCard
      title={t('careCascade', 'Care cascade')}
      link={{ label: t('report', 'Report'), to: careCascade.reportUrl }}
    >
      {error ? (
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title={t('couldNotLoadCareCascade', 'Could not load the care cascade')}
        />
      ) : isLoading ? (
        <div data-testid="cascade-loading">
          <SkeletonText paragraph lineCount={4} />
        </div>
      ) : steps.length ? (
        <>
          <div className={styles.steps}>
            {steps.map((row) => (
              <div key={row.step} data-testid="cascade-step" className={styles.step}>
                <span>{row.label}</span>
                <span className={styles.track}>
                  <span
                    data-testid="cascade-bar"
                    className={styles.bar}
                    style={{ width: `${largest ? Math.round((row.patients / largest) * 100) : 0}%` }}
                  />
                </span>
                <span className={styles.count}>{row.patients}</span>
              </div>
            ))}
          </div>
          <p className={styles.asOf}>
            {t('cascadeReportDate', 'Report date: {{date}}', {
              date: formatDate(today.toDate(), { time: false, noToday: true }),
            })}
          </p>
        </>
      ) : (
        <p className={styles.empty}>{t('noCareCascadeData', 'No care cascade data')}</p>
      )}
      <ScreenPositiveRow />
    </ActHomeCard>
  );
}

export default function CareCascade() {
  return (
    <ScreenAccess screen="registry">
      <Cascade />
    </ScreenAccess>
  );
}
