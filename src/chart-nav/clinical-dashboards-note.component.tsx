import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from './clinical-dashboards-note.scss';

/** Under the community clinician's chart nav: why it has fewer pages than a clinician's. */
export default function ClinicalDashboardsNote() {
  const { t } = useTranslation();
  return (
    <p className={styles.note}>
      {t('clinicalDashboardsOnlyForClinicians', 'Clinical dashboards are only visible to clinicians.')}
    </p>
  );
}
