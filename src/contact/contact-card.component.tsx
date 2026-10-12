import React from 'react';
import { useTranslation } from 'react-i18next';
import { CardHeader } from '@openmrs/esm-framework';
import { SummaryFields } from '../styles/summary-fields.component';
import { useContact } from './contact.resource';
import styles from '../styles/summary-card.scss';

/** The patient summary's contact details: phone and its owner, village, and the patient's clinics. */
export default function ContactCard({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const { contact, error } = useContact(patientUuid);

  if (error) {
    return null;
  }
  return (
    <div className={styles.card}>
      <CardHeader title={t('contact', 'Contact')}>
        <span />
      </CardHeader>
      <SummaryFields
        fields={
          contact && [
            { label: t('phone', 'Phone'), value: contact.phone },
            { label: t('phoneOwner', 'Phone owner'), value: contact.phoneOwner },
            { label: t('village', 'Village'), value: contact.village },
            { label: t('primaryCareClinic', 'Primary care clinic'), value: contact.primaryCareClinic },
            { label: t('cardiacClinic', 'Cardiac clinic'), value: contact.cardiacClinic },
            { label: t('tertiaryCareCentre', 'Tertiary care centre'), value: contact.tertiaryCentre },
          ]
        }
      />
    </div>
  );
}
