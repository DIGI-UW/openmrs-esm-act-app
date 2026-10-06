import React from 'react';
import { useTranslation } from 'react-i18next';
import { SkeletonText } from '@carbon/react';
import { ConfigurableLink, useConfig, UserHasAccess } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { PRIVILEGE_SCREEN_POSITIVE } from '../constants';
import { useReportDataset } from '../reports/report-dataset.resource';
import { screenPositiveDashboardMeta } from '../screen-positive/screen-positive.meta';
import styles from './screen-positive-count.scss';

function Row() {
  const { t } = useTranslation();
  const { screenPositive } = useConfig<Config>();
  // The list's own report, one row per patient, so the count is the list's length.
  const { rows, isLoading, error } = useReportDataset(screenPositive.report);

  return (
    <ConfigurableLink
      to={`\${openmrsSpaBase}/home/${screenPositiveDashboardMeta.name}`}
      className={styles.row}
      data-testid="screen-positive-row"
    >
      <span>{t('screenPositive', 'Screen positive, pending confirmation')}</span>
      {error ? (
        <span className={styles.error}>
          {t('couldNotLoadScreenPositive', 'Could not load the screen positive list')}
        </span>
      ) : isLoading ? (
        <span data-testid="screen-positive-count-loading" className={styles.loading}>
          <SkeletonText />
        </span>
      ) : (
        <span data-testid="screen-positive-count" className={styles.figure}>
          {rows.length}
        </span>
      )}
    </ConfigurableLink>
  );
}

export default function ScreenPositiveRow() {
  return (
    <UserHasAccess privilege={PRIVILEGE_SCREEN_POSITIVE}>
      <Row />
    </UserHasAccess>
  );
}
