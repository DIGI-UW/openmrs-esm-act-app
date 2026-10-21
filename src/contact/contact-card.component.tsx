import React from 'react';
import { useTranslation } from 'react-i18next';
import { SkeletonText } from '@carbon/react';
import { CardHeader, useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { usePersonDetails } from '../consultations/patient-details.resource';
import styles from '../styles/summary-card.scss';

/**
 * The patient summary's Contact card, as the prototype's: phone, phone owner, village and the two clinics
 * registration records. ACT 3 records no tertiary care centre of its own, so the prototype's last row is left out.
 */
export default function ContactCard({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const { contactCard } = useConfig<Config>();
  const { attributes, village, isLoading, error } = usePersonDetails(patientUuid);
  if (error) {
    return null;
  }
  const types = contactCard.attributeTypes;
  const fields = [
    { id: 'phone', label: t('phone', 'Phone'), value: attributes.get(types.phone) },
    { id: 'phone-owner', label: t('phoneOwner', 'Phone owner'), value: attributes.get(types.phoneOwner) },
    { id: 'village', label: t('village', 'Village'), value: village },
    {
      id: 'primary-care-clinic',
      label: t('primaryCareClinic', 'Primary care clinic'),
      value: attributes.get(types.primaryCareClinic),
    },
    { id: 'cardiac-clinic', label: t('cardiacClinic', 'Cardiac clinic'), value: attributes.get(types.cardiacClinic) },
  ];
  return (
    <div className={styles.card}>
      <CardHeader title={t('contact', 'Contact')} />
      {isLoading ? (
        <SkeletonText paragraph lineCount={2} />
      ) : (
        <dl className={styles.fields}>
          {fields.map((field) => (
            <div key={field.id} className={styles.field}>
              <dt className={styles.label}>{field.label}</dt>
              <dd className={styles.value} data-testid={`contact-${field.id}`}>
                {field.value || '--'}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
