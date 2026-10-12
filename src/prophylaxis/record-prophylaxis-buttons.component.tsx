import React from 'react';
import { useTranslation } from 'react-i18next';
import { useConfig } from '@openmrs/esm-framework';
import { RecordFormButton } from '../access/record-form-button.component';
import { type Config } from '../config-schema';
import { useOpenFormInVisit } from '../visits/open-form-in-visit';
import styles from '../styles/summary-card.scss';

/** Record BPG and Record oral, or only the one for the given type. */
export function RecordProphylaxisButtons({ patientUuid, only }: { patientUuid: string; only?: 'BPG' | 'Oral' }) {
  const { t } = useTranslation();
  const { prophylaxisCard } = useConfig<Config>();
  const opener = useOpenFormInVisit(patientUuid);
  const buttons = [
    { type: 'BPG', label: t('recordBpg', 'Record BPG'), form: prophylaxisCard.bpgForm },
    { type: 'Oral', label: t('recordOral', 'Record oral'), form: prophylaxisCard.oralForm },
  ].filter((button) => !only || button.type === only);

  return (
    <div className={styles.actions}>
      {buttons.map(({ label, form }) => (
        <RecordFormButton key={form} form={form} label={label} opener={opener} />
      ))}
    </div>
  );
}
