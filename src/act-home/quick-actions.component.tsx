import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Add, ArrowUpRight, Search } from '@carbon/react/icons';
import { ConfigurableLink, useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { ScreenAccess } from '../access/screen-access.component';
import styles from './quick-actions.scss';

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

/** Enter prophylaxis: the configured forms to choose from, as ACT 2.0 offered BPG and oral, else one link. */
function EnterProphylaxis() {
  const { t } = useTranslation();
  const { quickActions } = useConfig<Config>();
  const [open, setOpen] = useState(false);
  const label = t('enterProphylaxis', 'Enter prophylaxis');

  if (!quickActions.prophylaxisForms.length) {
    return (
      <ConfigurableLink to={quickActions.enterProphylaxisUrl} className={styles.action}>
        <ActionLabel label={label} Icon={ArrowUpRight} />
      </ConfigurableLink>
    );
  }
  return (
    <div className={styles.choice}>
      <button type="button" className={styles.action} aria-expanded={open} onClick={() => setOpen(!open)}>
        <ActionLabel label={label} Icon={ArrowUpRight} />
      </button>
      {open && (
        <ul aria-label={label} className={styles.choices}>
          {quickActions.prophylaxisForms.map((form) => (
            <li key={form.url}>
              <ConfigurableLink to={form.url} className={styles.choiceLink}>
                {form.label}
              </ConfigurableLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function QuickActions() {
  const { t } = useTranslation();
  const { quickActions } = useConfig<Config>();

  return (
    <ScreenAccess screen="home">
      <div className={styles.actions}>
        <ConfigurableLink to={quickActions.registerPatientUrl} className={styles.action}>
          <ActionLabel label={t('registerPatient', 'Register patient')} Icon={Add} />
        </ConfigurableLink>
        <EnterProphylaxis />
        <ConfigurableLink to={quickActions.findPatientUrl} className={styles.action}>
          <ActionLabel label={t('findPatient', 'Find a patient')} Icon={Search} />
        </ConfigurableLink>
      </div>
    </ScreenAccess>
  );
}
