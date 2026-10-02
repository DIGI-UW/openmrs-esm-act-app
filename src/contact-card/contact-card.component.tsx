import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, SkeletonText } from '@carbon/react';
import { CardHeader, EditIcon, navigate, useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { useContact } from './contact-card.resource';
import styles from '../styles/summary-card.scss';

export default function ContactCard({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const { contactCard } = useConfig<Config>();
  const { contact, error } = useContact(patientUuid);

  if (error) {
    return null;
  }

  const fields = contact && [
    { id: 'phone', label: t('phone', 'Phone'), value: contact.phone },
    { id: 'phone-owner', label: t('phoneOwner', 'Phone owner'), value: contact.phoneOwner },
    { id: 'village', label: t('village', 'Village'), value: contact.village },
    { id: 'primary-clinic', label: t('primaryClinic', 'Primary clinic'), value: contact.primaryClinic },
  ];

  return (
    <div className={styles.card}>
      <CardHeader title={t('contact', 'Contact')}>
        <div className={styles.actions}>
          <Button
            kind="ghost"
            size="sm"
            renderIcon={(props) => <EditIcon size={16} {...props} />}
            onClick={() => navigate({ to: contactCard.editUrl, templateParams: { patientUuid } })}
          >
            {t('edit', 'Edit')}
          </Button>
        </div>
      </CardHeader>
      {!fields ? (
        <SkeletonText paragraph lineCount={2} />
      ) : (
        <dl className={styles.fields}>
          {fields.map((field) => (
            <div key={field.id} className={styles.field}>
              <dt className={styles.label}>{field.label}</dt>
              <dd className={styles.value} data-testid={`contact-${field.id}`}>
                {field.value ?? '--'}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
