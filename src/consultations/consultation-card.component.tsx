import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@carbon/react';
import { AddIcon, CardHeader, formatDate, useConfig } from '@openmrs/esm-framework';
import { MayEnterForm } from '../access/may-enter-form';
import { type Config } from '../config-schema';
import { useContact } from '../contact/contact.resource';
import { SummaryFields } from '../styles/summary-fields.component';
import { useOpenFormInVisit } from '../visits/open-form-in-visit';
import { useConsultationSummary } from './consultations.resource';
import { useDiagnosis } from './diagnosis.resource';
import styles from '../styles/summary-card.scss';

const day = (date: Date | null) => (date ? formatDate(date, { time: false }) : null);

/** The patient summary's consultations: the last, the next cardiology review, the diagnosis and the cardiac clinic. */
export default function ConsultationCard({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const { consultations: config } = useConfig<Config>();
  const { last, nextReview, isLoading, error } = useConsultationSummary(patientUuid);
  const { diagnosis, isLoading: diagnosisLoading } = useDiagnosis(patientUuid);
  const { contact, isLoading: contactLoading } = useContact(patientUuid);
  const { open: openForm, isOpening } = useOpenFormInVisit(patientUuid);

  if (error) {
    return null;
  }
  // A diagnosis or clinic that cannot be read shows --, rather than holding the card back.
  const loaded = !isLoading && !diagnosisLoading && !contactLoading;
  return (
    <div className={styles.card}>
      <CardHeader title={t('consultationVisits', 'Consultation visits')}>
        <MayEnterForm formUuid={config.form}>
          <Button
            kind="ghost"
            size="sm"
            renderIcon={(props) => <AddIcon size={16} {...props} />}
            disabled={isOpening}
            onClick={() => openForm(config.form)}
          >
            {t('startConsultation', 'Start consultation')}
          </Button>
        </MayEnterForm>
      </CardHeader>
      <SummaryFields
        fields={
          loaded
            ? [
                { label: t('lastConsultation', 'Last consultation'), value: day(last?.date ?? null) },
                { label: t('nextCardiologyReview', 'Next cardiology review'), value: day(nextReview) },
                { label: t('diagnosis', 'Diagnosis'), value: diagnosis },
                { label: t('cardiacClinic', 'Cardiac clinic'), value: contact?.cardiacClinic ?? null },
              ]
            : null
        }
      />
    </div>
  );
}
