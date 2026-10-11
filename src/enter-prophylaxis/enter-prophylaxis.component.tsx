import React from 'react';
import { useTranslation } from 'react-i18next';
import { InlineNotification } from '@carbon/react';
import { useConfig, useSession } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { PatientSearchPanel } from '../patient-search/patient-search-panel.component';
import { openFormInChart } from '../visits/open-form-in-chart';

/** Record BPG or oral prophylaxis: pick the patient, and that form opens in their chart. */
export function EnterProphylaxisSearch({ onClose, prophylaxis }: { onClose: () => void; prophylaxis: 'bpg' | 'oral' }) {
  const { t } = useTranslation();
  const { prophylaxisCard, visitType } = useConfig<Config>();
  const { sessionLocation } = useSession();
  const label =
    prophylaxis === 'oral'
      ? t('recordOralProphylaxis', 'Record oral prophylaxis')
      : t('recordBpgInjection', 'Record BPG injection');

  return (
    <PatientSearchPanel
      onClose={onClose}
      label={label}
      onSelect={(patient) =>
        openFormInChart(t, {
          patientUuid: patient.uuid,
          formUuid: prophylaxis === 'oral' ? prophylaxisCard.oralForm : prophylaxisCard.bpgForm,
          visitType,
          location: sessionLocation?.uuid,
        })
      }
    >
      <InlineNotification
        kind="info"
        lowContrast
        hideCloseButton
        title={label}
        subtitle={t(
          'enterProphylaxisBanner',
          'Choose the patient. The form opens in their chart and a visit starts automatically.',
        )}
      />
    </PatientSearchPanel>
  );
}
