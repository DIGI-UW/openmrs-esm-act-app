import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowUpRight,
  ChartLine,
  Chemistry,
  Medication,
  Pills,
  Search,
  Settings,
  UserFollow,
  UserRole,
} from '@carbon/react/icons';
import { ConfigurableLink, useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { patientsOnProphylaxisDashboardMeta } from '../enter-prophylaxis/patients-on-prophylaxis.meta';
import { useRolePermissionsAssigned } from '../role-permissions/role-permissions-dashboard-link.component';
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

/** Find a patient: O3's patient search page. */
export function FindPatientAction() {
  const { t } = useTranslation();
  const { quickActions } = useConfig<Config>();
  return (
    <QuickActionTile
      Icon={Search}
      label={t('findPatient', 'Find a patient')}
      subtitle={t('nameOrActId', 'Name or ACT ID')}
      to={quickActions.findPatientUrl}
    />
  );
}

/** Record BPG or oral: the patients on prophylaxis, showing that prophylaxis, each with its Record button. */
function RecordProphylaxis({
  prophylaxis,
  ...tile
}: Omit<React.ComponentProps<typeof QuickActionTile>, 'to' | 'onClick'> & { prophylaxis: 'bpg' | 'oral' }) {
  return (
    <QuickActionTile
      {...tile}
      to={`\${openmrsSpaBase}/home/${patientsOnProphylaxisDashboardMeta.name}?prophylaxis=${prophylaxis}`}
    />
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
 * Enter prophylaxis: the registry's patients on prophylaxis, to record what each was given; or, configured back to fast
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
                {t(form.label)}
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

export function FormsAndSitesAction() {
  const { t } = useTranslation();
  const { instanceAdminQuickActions } = useConfig<Config>();
  return (
    <QuickActionTile
      Icon={Settings}
      label={t('formsAndSites', 'Forms & sites')}
      subtitle={t('configureInstance', 'Configure instance')}
      to={instanceAdminQuickActions.formsAndSitesUrl}
    />
  );
}

export function RolePermissionsAction() {
  const { t } = useTranslation();
  const { instanceAdminQuickActions } = useConfig<Config>();
  if (!useRolePermissionsAssigned()) {
    return null;
  }
  return (
    <QuickActionTile
      Icon={UserRole}
      label={t('rolePermissions', 'Role permissions')}
      subtitle={t('whoSeesWhat', 'Who sees what')}
      to={instanceAdminQuickActions.rolePermissionsUrl}
    />
  );
}

export function ResearchParticipationAction() {
  const { t } = useTranslation();
  const { instanceAdminQuickActions } = useConfig<Config>();
  return (
    <QuickActionTile
      Icon={Chemistry}
      label={t('studies', 'Studies')}
      subtitle={t('governedOffByDefault', 'Governed · OFF by default')}
      to={instanceAdminQuickActions.researchParticipationUrl}
    />
  );
}
