import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@carbon/react';
import { AddIcon, useConfig } from '@openmrs/esm-framework';
import { MayEnterForm } from '../access/may-enter-form';
import { type Config } from '../config-schema';
import { useOpenFormInVisit } from '../visits/open-form-in-visit';
import styles from '../styles/summary-card.scss';

/** Record BPG and Record oral, or only the one for the given type. */
export function RecordProphylaxisButtons({ patientUuid, only }: { patientUuid: string; only?: 'BPG' | 'Oral' }) {
  const { t } = useTranslation();
  const { prophylaxisCard } = useConfig<Config>();
  const { open: openForm, isOpening } = useOpenFormInVisit(patientUuid);
  const buttons = [
    { type: 'BPG', label: t('recordBpg', 'Record BPG'), form: prophylaxisCard.bpgForm },
    { type: 'Oral', label: t('recordOral', 'Record oral'), form: prophylaxisCard.oralForm },
  ].filter((button) => !only || button.type === only);

  return (
    <div className={styles.actions}>
      {buttons.map(({ label, form }) => (
        <MayEnterForm key={form} formUuid={form}>
          <Button
            kind="ghost"
            size="sm"
            renderIcon={(props) => <AddIcon size={16} {...props} />}
            disabled={isOpening}
            onClick={() => openForm(form)}
          >
            {label}
          </Button>
        </MayEnterForm>
      ))}
    </div>
  );
}
