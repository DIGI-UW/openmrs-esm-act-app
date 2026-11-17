import React from 'react';
import { useTranslation } from 'react-i18next';
import { useConfig, userHasAccess, useSession } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import styles from './clinicians-only-note.scss';

/**
 * Under the chart's pages, for a user who is not a clinician, as the prototype's community clinician reads: the
 * clinical pages are hidden from them, not missing.
 */
export default function CliniciansOnlyNote() {
  const { t } = useTranslation();
  const { clinicianPrivilege } = useConfig<Config>();
  const { user } = useSession();
  if (!user || userHasAccess(clinicianPrivilege, user)) {
    return null;
  }
  return (
    <p className={styles.note} data-testid="clinicians-only-note">
      {t('clinicalDashboardsCliniciansOnly', 'Clinical dashboards are only visible to clinicians.')}
    </p>
  );
}
