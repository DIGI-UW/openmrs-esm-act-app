import React from 'react';
import { useTranslation } from 'react-i18next';
import { Tag } from '@carbon/react';
import { WarningFilled } from '@carbon/react/icons';
import { useProphylaxisSummary } from '../prophylaxis/prophylaxis.resource';
import { pillsClassName } from './status-pill.component';
import styles from './status-pill.scss';

/** The patient banner's safety alert while ACT Core holds BPG after an anaphylaxis no consultation has reviewed. */
export default function AnaphylaxisAlert({ patientUuid, patient }: { patientUuid: string; patient?: fhir.Patient }) {
  const { t } = useTranslation();
  const deceased = Boolean(patient?.deceasedBoolean || patient?.deceasedDateTime);
  const { summary } = useProphylaxisSummary(deceased ? null : patientUuid);
  if (deceased || !summary?.bpgOnHold) {
    return null;
  }
  return (
    <span
      className={pillsClassName}
      title={t('bpgOnHoldReason', 'Anaphylaxis reported after BPG: a clinician must review before the next dose')}
    >
      <Tag type="red" size="md" renderIcon={WarningFilled} className={styles.alertTag} data-testid="anaphylaxis-alert">
        {t('anaphylaxisAfterBpg', 'Anaphylaxis after BPG: BPG on hold')}
      </Tag>
    </span>
  );
}
