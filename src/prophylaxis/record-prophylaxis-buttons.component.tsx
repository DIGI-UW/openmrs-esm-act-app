import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Tag } from '@carbon/react';
import { AddIcon, useConfig, userHasAccess, useSession } from '@openmrs/esm-framework';
import { MayEnterForm } from '../access/may-enter-form';
import { type Config } from '../config-schema';
import { heldBpgStep, useNextSteps } from '../next-steps/next-steps.resource';
import { useOpenFormInVisit } from '../visits/open-form-in-visit';
import { useProphylaxisSummary } from './prophylaxis.resource';
import styles from '../styles/summary-card.scss';

/**
 * Record BPG and Record oral, or only the one for the type prescribed once the summary says which. A clinician, who may
 * change the regimen, keeps both. A held BPG drops only this button: a withheld dose is still recorded from All forms.
 */
export function RecordProphylaxisButtons({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const { prophylaxisCard, nextSteps, clinicianPrivilege } = useConfig<Config>();
  const { user } = useSession();
  const clinician = Boolean(user) && userHasAccess(clinicianPrivilege, user);
  const { open: openForm, isOpening } = useOpenFormInVisit(patientUuid);
  const { summary } = useProphylaxisSummary(patientUuid);
  const held = heldBpgStep(useNextSteps(nextSteps.enabled ? patientUuid : null).steps);
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
  ].filter((button) => clinician || !prescribed || button.type === prescribed);

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
