import React from 'react';
import { useTranslation } from 'react-i18next';
import { Add, ArrowUpRight, Search } from '@carbon/react/icons';
import { ConfigurableLink, useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { ScreenAccess } from '../access/screen-access.component';
import styles from './quick-actions.scss';

export default function QuickActions() {
  const { t } = useTranslation();
  const { quickActions } = useConfig<Config>();
  const actions = [
    { label: t('registerPatient', 'Register patient'), to: quickActions.registerPatientUrl, Icon: Add },
    { label: t('enterProphylaxis', 'Enter prophylaxis'), to: quickActions.enterProphylaxisUrl, Icon: ArrowUpRight },
    { label: t('findPatient', 'Find a patient'), to: quickActions.findPatientUrl, Icon: Search },
  ];

  return (
    <ScreenAccess screen="home">
      <div className={styles.actions}>
        {actions.map(({ label, to, Icon }) => (
          <ConfigurableLink key={label} to={to} className={styles.action}>
            <span className={styles.icon}>
              <Icon size={20} />
            </span>
            {label}
          </ConfigurableLink>
        ))}
      </div>
    </ScreenAccess>
  );
}
