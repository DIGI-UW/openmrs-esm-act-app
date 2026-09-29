import React from 'react';
import { useTranslation } from 'react-i18next';
import { InlineNotification, SkeletonText } from '@carbon/react';
import { useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { ScreenAccess } from '../access/screen-access.component';
import { useReportDataset } from '../reports/report-dataset.resource';
import { screenPositiveDashboardMeta } from '../screen-positive/screen-positive.meta';
import { ActHomeCard } from './act-home-card.component';
import styles from './screen-positive-count.scss';

function Count() {
  const { t } = useTranslation();
  const { screenPositive } = useConfig<Config>();
  // The list's own report, one row per patient, so the count is the list's length.
  const { rows, isLoading, error } = useReportDataset(screenPositive.report);

  return (
    <ActHomeCard
      title={t('screenPositive', 'Screen positive, pending confirmation')}
      link={{ label: t('open', 'Open'), to: `\${openmrsSpaBase}/home/${screenPositiveDashboardMeta.name}` }}
    >
      {error ? (
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title={t('couldNotLoadScreenPositive', 'Could not load the screen positive list')}
        />
      ) : isLoading ? (
        <div data-testid="screen-positive-count-loading">
          <SkeletonText />
        </div>
      ) : (
        <p className={styles.count}>
          <span data-testid="screen-positive-count" className={styles.figure}>
            {rows.length}
          </span>
          <span>{t('patientsWaitingForEcho', 'waiting for a confirmatory echo')}</span>
        </p>
      )}
    </ActHomeCard>
  );
}

export default function ScreenPositiveCount() {
  return (
    <ScreenAccess screen="screenPositive">
      <Count />
    </ScreenAccess>
  );
}
