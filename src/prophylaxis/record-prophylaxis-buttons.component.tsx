import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@carbon/react';
import { AddIcon, useConfig } from '@openmrs/esm-framework';
import { MayEnterForm } from '../access/may-enter-form';
import { type Config } from '../config-schema';
import { useOpenFormInVisit } from '../visits/open-form-in-visit';
import styles from '../styles/summary-card.scss';

export function RecordProphylaxisButtons({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const { prophylaxisCard } = useConfig<Config>();
  const { open: openForm, isOpening } = useOpenFormInVisit(patientUuid);
  const buttons = [
    { label: t('recordBpg', 'Record BPG'), form: prophylaxisCard.bpgForm },
    { label: t('recordOral', 'Record oral'), form: prophylaxisCard.oralForm },
  ];

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
