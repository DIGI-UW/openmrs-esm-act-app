import React from 'react';
import { useTranslation } from 'react-i18next';
import { OverflowMenuItem } from '@carbon/react';
import { showModal } from '@openmrs/esm-framework';

/**
 * Update patient status in the patient chart's Actions menu. It opens its dialog through the modal system, as the menu
 * unmounts this when the item is chosen.
 */
export default function UpdatePatientStatusButton({
  patientUuid,
  closeMenu,
}: {
  patientUuid: string;
  closeMenu?: () => void;
}) {
  const { t } = useTranslation();
  const open = () => {
    const dispose = showModal('update-patient-status-modal', { closeModal: () => dispose(), patientUuid });
  };
  return (
    <OverflowMenuItem
      itemText={t('updatePatientStatus', 'Update patient status')}
      onClick={open}
      closeMenu={closeMenu}
    />
  );
}
