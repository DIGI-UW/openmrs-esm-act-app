import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChartLine, Medication, Pills, Search, UserFollow } from '@carbon/react/icons';
import { ConfigurableLink, useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { ActionLabel, FindPatient } from '../act-home/quick-actions.component';
import { EnterProphylaxisSearch } from '../enter-prophylaxis/enter-prophylaxis.component';
import styles from '../act-home/quick-actions.scss';

// ACT home's quick action tile, drawn with its subtitle under its label.
const tile = `${styles.action} ${styles.stacked}`;

/** Record BPG or oral: ACT's patient search, opening that form in the chosen patient's chart. */
function RecordProphylaxis({ prophylaxis, children }: { prophylaxis: 'bpg' | 'oral'; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className={tile} onClick={() => setOpen(true)}>
        {children}
      </button>
      {open && <EnterProphylaxisSearch prophylaxis={prophylaxis} onClose={() => setOpen(false)} />}
    </>
  );
}

export function RecordBpgAction() {
  const { t } = useTranslation();

  return (
    <RecordProphylaxis prophylaxis="bpg">
      <ActionLabel
        Icon={Medication}
        label={t('recordBpgInjection', 'Record BPG injection')}
        subtitle={t('benzathinePenicillinG', 'Benzathine penicillin G')}
      />
    </RecordProphylaxis>
  );
}

export function RecordOralAction() {
  const { t } = useTranslation();

  return (
    <RecordProphylaxis prophylaxis="oral">
      <ActionLabel
        Icon={Pills}
        label={t('recordOralProphylaxis', 'Record oral prophylaxis')}
        subtitle={t('oralAdherence', 'Oral adherence')}
      />
    </RecordProphylaxis>
  );
}

export function RegisterPatientAction() {
  const { t } = useTranslation();
  const { quickActions } = useConfig<Config>();

  return (
    <ConfigurableLink to={quickActions.registerPatientUrl} className={tile}>
      <ActionLabel
        Icon={UserFollow}
        label={t('registerPatient', 'Register patient')}
        subtitle={t('startSomeoneOnCare', 'Start someone on care')}
      />
    </ConfigurableLink>
  );
}

export function FindPatientAction() {
  const { t } = useTranslation();

  return (
    <FindPatient className={tile}>
      <ActionLabel
        Icon={Search}
        label={t('findPatient', 'Find a patient')}
        subtitle={t('nameOrActId', 'Name or ACT ID')}
      />
    </FindPatient>
  );
}

export function FacilityReportAction() {
  const { t } = useTranslation();
  const { dataClerkQuickActions } = useConfig<Config>();

  return (
    <ConfigurableLink to={dataClerkQuickActions.facilityReportUrl} className={tile}>
      <ActionLabel
        Icon={ChartLine}
        label={t('facilityReport', 'Facility report')}
        subtitle={t('monthlyQuarterly', 'Monthly · quarterly')}
      />
    </ConfigurableLink>
  );
}
