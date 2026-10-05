import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@carbon/react';
import { AddIcon, useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { useActionAccess } from '../access/screen-access.component';
import { useOpenFormInVisit } from '../visits/open-form-in-visit';
import styles from '../styles/summary-card.scss';

export function RecordProphylaxisButtons({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const { prophylaxisCard } = useConfig<Config>();
  const { open: openForm, isOpening } = useOpenFormInVisit(patientUuid);
  const mayRecord = useActionAccess('recordProphylaxis');
  const buttons = [
    { label: t('recordBpg', 'Record BPG'), form: prophylaxisCard.bpgForm },
    { label: t('recordOral', 'Record oral'), form: prophylaxisCard.oralForm },
  ];

  if (!mayRecord) {
    return null;
  }
  return (
    <div className={styles.actions}>
      {buttons.map(({ label, form }) => (
        <Button
          key={form}
          kind="ghost"
          size="sm"
          renderIcon={(props) => <AddIcon size={16} {...props} />}
          disabled={isOpening}
          onClick={() => openForm(form)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
