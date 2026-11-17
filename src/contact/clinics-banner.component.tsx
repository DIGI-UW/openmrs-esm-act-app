import React from 'react';
import { useTranslation } from 'react-i18next';
import { useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { usePersonDetails } from '../consultations/patient-details.resource';
import styles from './clinics-banner.scss';

/**
 * The patient's primary care clinic and cardiac clinic, at the end of the banner's age and ACT ID line. The banner's
 * Show more carries the phone and village.
 */
export default function ClinicsBanner({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const { contactCard } = useConfig<Config>();
  const { attributes } = usePersonDetails(patientUuid);
  const clinics = [
    {
      id: 'primary-care',
      label: t('primaryCareClinic', 'Primary care clinic'),
      value: attributes.get(contactCard.attributeTypes.primaryCareClinic),
    },
    {
      id: 'cardiac',
      label: t('cardiacClinic', 'Cardiac clinic'),
      value: attributes.get(contactCard.attributeTypes.cardiacClinic),
    },
  ].filter((clinic) => clinic.value);
  return (
    <>
      {clinics.map((clinic) => (
        <span key={clinic.id} className={styles.clinic} data-testid={`banner-${clinic.id}-clinic`}>
          <span className={styles.separator}>&middot;</span>
          {clinic.label}: {clinic.value}
        </span>
      ))}
    </>
  );
}
