import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Add, ArrowUpRight, Search } from '@carbon/react/icons';
import { ConfigurableLink, useConfig, UserHasAccess } from '@openmrs/esm-framework';
import { PRIVILEGE_ADD_ENCOUNTERS, PRIVILEGE_ADD_PATIENTS, PRIVILEGE_GET_PATIENTS } from '../constants';
import { type Config } from '../config-schema';
import { EnterProphylaxisSearch } from '../enter-prophylaxis/enter-prophylaxis.component';
import { PatientSearchPanel } from '../patient-search/patient-search-panel.component';
import styles from './quick-actions.scss';

export function ActionLabel({ label, Icon }: { label: string; Icon: typeof Add }) {
  return (
    <>
      <span className={styles.icon}>
        <Icon size={20} />
      </span>
      {label}
    </>
  );
}

/**
 * Enter prophylaxis: ACT's patient search, opening the form in the chart; or, configured back to fast data
 * entry, its forms to choose from, as ACT 2.0 offered BPG and oral, else one link.
 */
function EnterProphylaxis() {
  const { t } = useTranslation();
  const { quickActions } = useConfig<Config>();
  const [open, setOpen] = useState(false);
  const label = t('enterProphylaxis', 'Enter prophylaxis');

  if (!quickActions.enterProphylaxisInFastDataEntry) {
    return (
      <>
        <button type="button" className={styles.action} onClick={() => setOpen(true)}>
          <ActionLabel label={label} Icon={ArrowUpRight} />
        </button>
        {open && <EnterProphylaxisSearch onClose={() => setOpen(false)} />}
      </>
    );
  }
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

/** Find a patient: ACT's patient search over the page, or the configured page. Its tile is ACT home's unless given. */
export function FindPatient({
  className = styles.action,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const { quickActions } = useConfig<Config>();
  const [open, setOpen] = useState(false);
  const label = children ?? <ActionLabel label={t('findPatient', 'Find a patient')} Icon={Search} />;

  if (!quickActions.findPatientInPanel) {
    return (
      <ConfigurableLink to={quickActions.findPatientUrl} className={className}>
        {label}
      </ConfigurableLink>
    );
  }
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && <PatientSearchPanel onClose={() => setOpen(false)} />}
    </>
  );
}

export default function QuickActions() {
  const { t } = useTranslation();
  const { quickActions } = useConfig<Config>();

  return (
    <div className={styles.actions}>
      <UserHasAccess privilege={PRIVILEGE_ADD_PATIENTS}>
        <ConfigurableLink to={quickActions.registerPatientUrl} className={styles.action}>
          <ActionLabel label={t('registerPatient', 'Register patient')} Icon={Add} />
        </ConfigurableLink>
      </UserHasAccess>
      <UserHasAccess privilege={PRIVILEGE_ADD_ENCOUNTERS}>
        <EnterProphylaxis />
      </UserHasAccess>
      <UserHasAccess privilege={PRIVILEGE_GET_PATIENTS}>
        <FindPatient />
      </UserHasAccess>
    </div>
  );
}
