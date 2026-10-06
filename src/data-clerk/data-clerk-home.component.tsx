import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Medication, Pills, Report } from '@carbon/react/icons';
import { ConfigurableLink, useConfig, UserHasAccess } from '@openmrs/esm-framework';
import { PRIVILEGE_ADD_ENCOUNTERS } from '../constants';
import { type Config } from '../config-schema';
import { ActionLabel } from '../act-home/quick-actions.component';
import { EnterProphylaxisSearch } from '../enter-prophylaxis/enter-prophylaxis.component';
import styles from '../act-home/quick-actions.scss';

/** Record BPG or oral: ACT's patient search, opening that form in the chart. */
function RecordProphylaxis({ prophylaxis }: { prophylaxis: 'bpg' | 'oral' }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className={styles.action} onClick={() => setOpen(true)}>
        {prophylaxis === 'oral' ? (
          <ActionLabel label={t('recordOral', 'Record oral')} Icon={Pills} />
        ) : (
          <ActionLabel label={t('recordBpg', 'Record BPG')} Icon={Medication} />
        )}
      </button>
      {open && <EnterProphylaxisSearch prophylaxis={prophylaxis} onClose={() => setOpen(false)} />}
    </>
  );
}

export default function DataClerkHome() {
  const { t } = useTranslation();
  const { dataClerkQuickActions } = useConfig<Config>();

  return (
    <div className={styles.actions}>
      <UserHasAccess privilege={PRIVILEGE_ADD_ENCOUNTERS}>
        <RecordProphylaxis prophylaxis="bpg" />
        <RecordProphylaxis prophylaxis="oral" />
      </UserHasAccess>
      <ConfigurableLink to={dataClerkQuickActions.facilityReportUrl} className={styles.action}>
        <ActionLabel label={t('facilityReport', 'Facility report')} Icon={Report} />
      </ConfigurableLink>
    </div>
  );
}
