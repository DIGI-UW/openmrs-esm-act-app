import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Tag } from '@carbon/react';
import { AddIcon, useConfig } from '@openmrs/esm-framework';
import { MayEnterForm } from '../access/may-enter-form';
import { type Config } from '../config-schema';
import { heldBpgStep, useNextSteps } from '../next-steps/next-steps.resource';
import { useOpenFormInVisit } from '../visits/open-form-in-visit';
import { useProphylaxisSummary } from './prophylaxis.resource';
import styles from '../styles/summary-card.scss';

/**
 * Record BPG and Record oral, or only the one for the type prescribed once the summary says which. A patient with no
 * prescription in force gets Needs prescription instead, as Enter prophylaxis labels them: a dose recorded then has
 * no regimen to count against. While ACT Core holds the BPG step, after an anaphylaxis no consultation has reviewed,
 * BPG on hold stands in for Record BPG, as the Next steps card offers no form either; a withheld dose is still
 * recorded from All forms.
 */
export function RecordProphylaxisButtons({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const { prophylaxisCard } = useConfig<Config>();
  const { open: openForm, isOpening } = useOpenFormInVisit(patientUuid);
  const { summary } = useProphylaxisSummary(patientUuid);
  const held = heldBpgStep(useNextSteps(patientUuid).steps);
  const prescribed = summary?.type;

  if (summary?.status === 'none') {
    return (
      <span className={styles.needsPrescription} data-testid="needs-prescription">
        {t('needsPrescription', 'Needs prescription')}
      </span>
    );
  }
  const buttons = [
    { type: 'BPG', label: t('recordBpg', 'Record BPG'), form: prophylaxisCard.bpgForm },
    { type: 'Oral', label: t('recordOral', 'Record oral'), form: prophylaxisCard.oralForm },
  ].filter((button) => !prescribed || button.type === prescribed);

  return (
    <div className={styles.actions}>
      {buttons.map(({ type, label, form }) =>
        type === 'BPG' && held ? (
          <span key={form} title={held.reason} data-testid="bpg-on-hold">
            <Tag type="gray" size="sm">
              {t('bpgOnHold', 'BPG on hold')}
            </Tag>
          </span>
        ) : (
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
        ),
      )}
    </div>
  );
}
