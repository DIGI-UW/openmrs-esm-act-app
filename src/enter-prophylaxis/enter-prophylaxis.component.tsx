import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ContentSwitcher, InlineNotification, Switch } from '@carbon/react';
import { openmrsFetch, restBaseUrl, useConfig, useSession } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { type ProphylaxisSummary } from '../prophylaxis/prophylaxis.resource';
import { PatientSearchPanel } from '../patient-search/patient-search-panel.component';
import { openFormInChart } from '../visits/open-form-in-chart';
import styles from './enter-prophylaxis.scss';

const choices = ['asPrescribed', 'bpg', 'oral'] as const;
type Choice = (typeof choices)[number];

/** Enter prophylaxis: pick the patient and which prophylaxis, and the form opens in their chart. */
export function EnterProphylaxisSearch({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const { prophylaxisCard, visitType } = useConfig<Config>();
  const { sessionLocation } = useSession();
  const [choice, setChoice] = useState<Choice>('asPrescribed');
  const labels: Record<Choice, string> = {
    asPrescribed: t('asPrescribed', 'As prescribed'),
    bpg: t('bpgInjection', 'BPG injection'),
    oral: t('oralProphylaxis', 'Oral prophylaxis'),
  };
  const helpers: Record<Choice, string> = {
    asPrescribed: t('asPrescribedHelper', "Opens the BPG or oral form based on each patient's current prescription."),
    bpg: t('bpgHelper', 'Always opens the BPG form.'),
    oral: t('oralHelper', 'Always opens the oral prophylaxis form.'),
  };

  const formFor = async (patientUuid: string) => {
    if (choice !== 'asPrescribed') {
      return choice === 'oral' ? prophylaxisCard.oralForm : prophylaxisCard.bpgForm;
    }
    // A patient with no prescription, or one whose summary cannot be read, gets the BPG form.
    const summary = await openmrsFetch<ProphylaxisSummary>(`${restBaseUrl}/actcore/prophylaxis?patient=${patientUuid}`)
      .then(({ data }) => data)
      .catch(() => null);
    return summary?.type === 'Oral' ? prophylaxisCard.oralForm : prophylaxisCard.bpgForm;
  };

  return (
    <PatientSearchPanel
      onClose={onClose}
      label={t('enterProphylaxis', 'Enter prophylaxis')}
      onSelect={async (patient) =>
        openFormInChart(t, {
          patientUuid: patient.uuid,
          formUuid: await formFor(patient.uuid),
          visitType,
          location: sessionLocation?.uuid,
        })
      }
    >
      <InlineNotification
        kind="info"
        lowContrast
        hideCloseButton
        title={t('enterProphylaxis', 'Enter prophylaxis')}
        subtitle={t(
          'enterProphylaxisBanner',
          'Choose the patient. The form opens in their chart and a visit starts automatically.',
        )}
      />
      <div className={styles.choice}>
        <p className={styles.label}>{t('whichProphylaxis', 'Which prophylaxis?')}</p>
        <ContentSwitcher
          selectedIndex={choices.indexOf(choice)}
          onChange={({ index }) => setChoice(choices[index])}
          size="md"
        >
          {choices.map((key) => (
            <Switch key={key} name={key} text={labels[key]} />
          ))}
        </ContentSwitcher>
        <p className={styles.helper}>{helpers[choice]}</p>
      </div>
    </PatientSearchPanel>
  );
}
