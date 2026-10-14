import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@carbon/react';
import { AddIcon, useConfig } from '@openmrs/esm-framework';
import { MayEnterForm } from '../access/may-enter-form';
import { type Config } from '../config-schema';
import { useOpenFormInVisit } from '../visits/open-form-in-visit';
import { useProphylaxisSummary } from './prophylaxis.resource';
import styles from '../styles/summary-card.scss';

/** Record BPG and Record oral, or only the one for the type prescribed once the summary says which. */
export function RecordProphylaxisButtons({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const { prophylaxisCard } = useConfig<Config>();
  const { open: openForm, isOpening } = useOpenFormInVisit(patientUuid);
  const prescribed = useProphylaxisSummary(patientUuid).summary?.type;
  const buttons = [
    { type: 'BPG', label: t('recordBpg', 'Record BPG'), form: prophylaxisCard.bpgForm },
    { type: 'Oral', label: t('recordOral', 'Record oral'), form: prophylaxisCard.oralForm },
  ].filter((button) => !prescribed || button.type === prescribed);

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
