import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, ChartLine, Medication, Pills, Search, UserFollow } from '@carbon/react/icons';
import { ConfigurableLink, useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { EnterProphylaxisSearch } from '../enter-prophylaxis/enter-prophylaxis.component';
import { patientsOnProphylaxisDashboardMeta } from '../enter-prophylaxis/patients-on-prophylaxis.meta';
import { PatientSearchPanel } from '../patient-search/patient-search-panel.component';
import { QuickActionTile } from './quick-action-tile.component';
import styles from './quick-actions.scss';

/** Each action is its own extension, in the quick action slot of every home it belongs on (routes.json). */

export function RegisterPatientAction() {
  const { t } = useTranslation();
  const { quickActions } = useConfig<Config>();
  return (
    <QuickActionTile
      Icon={UserFollow}
      label={t('registerPatient', 'Register patient')}
      subtitle={t('startSomeoneOnCare', 'Start someone on care')}
      to={quickActions.registerPatientUrl}
    />
  );
}

/** Find a patient: ACT's patient search over the page, or the configured page. */
export function FindPatientAction() {
  const { t } = useTranslation();
  const { quickActions } = useConfig<Config>();
  const [open, setOpen] = useState(false);
  const tile = {
    Icon: Search,
    label: t('findPatient', 'Find a patient'),
    subtitle: t('nameOrActId', 'Name or ACT ID'),
  };
  if (!quickActions.findPatientInPanel) {
    return <QuickActionTile {...tile} to={quickActions.findPatientUrl} />;
  }
  return (
    <>
      <QuickActionTile {...tile} onClick={() => setOpen(true)} />
      {open && <PatientSearchPanel onClose={() => setOpen(false)} />}
    </>
  );
}

/** Record BPG or oral: ACT's patient search, opening that form in the chosen patient's chart. */
function RecordProphylaxis({
  prophylaxis,
  ...tile
}: React.ComponentProps<typeof QuickActionTile> & { prophylaxis: 'bpg' | 'oral' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <QuickActionTile {...tile} onClick={() => setOpen(true)} />
      {open && <EnterProphylaxisSearch prophylaxis={prophylaxis} onClose={() => setOpen(false)} />}
    </>
  );
}

export function RecordBpgAction() {
  const { t } = useTranslation();
  return (
    <RecordProphylaxis
      prophylaxis="bpg"
      Icon={Medication}
      label={t('recordBpgInjection', 'Record BPG injection')}
      subtitle={t('benzathinePenicillinG', 'Benzathine penicillin G')}
    />
  );
}

export function RecordOralAction() {
  const { t } = useTranslation();
  return (
    <RecordProphylaxis
      prophylaxis="oral"
      Icon={Pills}
      label={t('recordOralProphylaxis', 'Record oral prophylaxis')}
      subtitle={t('oralAdherence', 'Oral adherence')}
    />
  );
}

/**
 * Enter prophylaxis: the clinic's patients on prophylaxis, to record what each was given; or, configured back to fast
 * data entry, its forms to choose from, as ACT 2.0 offered BPG and oral, else one link.
 */
export function EnterProphylaxisAction() {
  const { t } = useTranslation();
  const { quickActions } = useConfig<Config>();
  const [open, setOpen] = useState(false);
  const tile = {
    Icon: ArrowUpRight,
    label: t('enterProphylaxis', 'Enter prophylaxis'),
    subtitle: t('bpgOrOral', 'BPG or oral'),
  };

  if (!quickActions.enterProphylaxisInFastDataEntry) {
    return <QuickActionTile {...tile} to={`\${openmrsSpaBase}/home/${patientsOnProphylaxisDashboardMeta.name}`} />;
  }
  if (!quickActions.prophylaxisForms.length) {
    return <QuickActionTile {...tile} to={quickActions.enterProphylaxisUrl} />;
  }
  return (
    <div className={styles.choice}>
      <QuickActionTile {...tile} onClick={() => setOpen(!open)} expanded={open} />
      {open && (
        <ul aria-label={tile.label} className={styles.choices}>
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

export function FacilityReportAction() {
  const { t } = useTranslation();
  const { dataClerkQuickActions } = useConfig<Config>();
  return (
    <QuickActionTile
      Icon={ChartLine}
      label={t('facilityReport', 'Facility report')}
      subtitle={t('monthlyQuarterly', 'Monthly · quarterly')}
      to={dataClerkQuickActions.facilityReportUrl}
    />
  );
}
