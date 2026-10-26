import React from 'react';
import { useTranslation } from 'react-i18next';
import { OverflowMenuItem } from '@carbon/react';
import { launchWorkspace2 } from '@openmrs/esm-framework';

/** Update patient status in the patient chart's Actions menu, which opens its workspace. */
export default function UpdatePatientStatusButton({ closeMenu }: { closeMenu?: () => void }) {
  const { t } = useTranslation();
  return (
    <OverflowMenuItem
      itemText={t('updatePatientStatus', 'Update patient status')}
      onClick={() => launchWorkspace2('act-update-patient-status-workspace')}
      closeMenu={closeMenu}
    />
  );
}
