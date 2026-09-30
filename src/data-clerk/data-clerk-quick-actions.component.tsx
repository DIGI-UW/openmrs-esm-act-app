import React from 'react';
import { useTranslation } from 'react-i18next';
import { Add, ArrowUpRight, Report, Search } from '@carbon/react/icons';
import { ConfigurableLink, useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { ScreenAccess } from '../access/screen-access.component';
import styles from './data-clerk-quick-actions.scss';

function ActionLabel({ label, Icon }: { label: string; Icon: typeof Add }) {
  return (
    <>
      <span className={styles.icon}>
        <Icon size={20} />
      </span>
      {label}
    </>
  );
}

export default function DataClerkQuickActions() {
  const { t } = useTranslation();
  const { dataClerkQuickActions } = useConfig<Config>();

  return (
    <ScreenAccess screen="dataClerk">
      <div className={styles.actions}>
        <ConfigurableLink to={dataClerkQuickActions.recordBpgUrl} className={styles.action}>
          <ActionLabel label={t('recordBpg', 'Record BPG injection')} Icon={ArrowUpRight} />
        </ConfigurableLink>
        <ConfigurableLink to={dataClerkQuickActions.recordOralUrl} className={styles.action}>
          <ActionLabel label={t('recordOral', 'Record oral prophylaxis')} Icon={ArrowUpRight} />
        </ConfigurableLink>
        <ConfigurableLink to={dataClerkQuickActions.registerPatientUrl} className={styles.action}>
          <ActionLabel label={t('registerPatient', 'Register patient')} Icon={Add} />
        </ConfigurableLink>
        <ConfigurableLink to={dataClerkQuickActions.findPatientUrl} className={styles.action}>
          <ActionLabel label={t('findPatient', 'Find a patient')} Icon={Search} />
        </ConfigurableLink>
        <ConfigurableLink to={dataClerkQuickActions.facilityReportUrl} className={styles.action}>
          <ActionLabel label={t('facilityReport', 'Facility report')} Icon={Report} />
        </ConfigurableLink>
      </div>
    </ScreenAccess>
  );
}
