import React from 'react';
import { useTranslation } from 'react-i18next';
import { Medication, Pills, Report } from '@carbon/react/icons';
import { ConfigurableLink, useConfig, UserHasAccess } from '@openmrs/esm-framework';
import { PRIVILEGE_DATA_CLERK } from '../constants';
import { type Config } from '../config-schema';
import styles from './data-clerk-home.scss';

function ActionLabel({ label, Icon }: { label: string; Icon: typeof Report }) {
  return (
    <>
      <span className={styles.icon}>
        <Icon size={20} />
      </span>
      {label}
    </>
  );
}

export default function DataClerkHome() {
  const { t } = useTranslation();
  const { dataClerkQuickActions } = useConfig<Config>();

  return (
    <UserHasAccess privilege={PRIVILEGE_DATA_CLERK}>
      <div className={styles.actions}>
        <ConfigurableLink to={dataClerkQuickActions.recordBpgUrl} className={styles.action}>
          <ActionLabel label={t('recordBpg', 'Record BPG')} Icon={Medication} />
        </ConfigurableLink>
        <ConfigurableLink to={dataClerkQuickActions.recordOralUrl} className={styles.action}>
          <ActionLabel label={t('recordOral', 'Record oral')} Icon={Pills} />
        </ConfigurableLink>
        <ConfigurableLink to={dataClerkQuickActions.facilityReportUrl} className={styles.action}>
          <ActionLabel label={t('facilityReport', 'Facility report')} Icon={Report} />
        </ConfigurableLink>
      </div>
    </UserHasAccess>
  );
}
