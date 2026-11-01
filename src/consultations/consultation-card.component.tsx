import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, SkeletonText } from '@carbon/react';
import { AddIcon, CardHeader, EditIcon, formatDate, parseDate, useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { useNextCardiologyVisit } from '../patient-status/cardiology.resource';
import { daysUntil } from '../patient-status/due-tone';
import { useStartConsultation } from './consultations.component';
import { useConsultations } from './consultations.resource';
import { useLatestDiagnosis, usePersonDetails } from './patient-details.resource';
import styles from '../styles/summary-card.scss';

/**
 * The patient summary's Consultation visits card, as the prototype's: the last consultation, the next cardiology
 * review (red once overdue), the diagnosis and the cardiac clinic, with Start consultation for the clinician and Edit
 * under the last consultation, which reopens it.
 */
export default function ConsultationCard({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const { contactCard } = useConfig<Config>();
  const { consultations, isLoading } = useConsultations(patientUuid);
  const { nextDue } = useNextCardiologyVisit(patientUuid);
  const { diagnosis, isLoading: diagnosisLoading } = useLatestDiagnosis(patientUuid);
  const { attributes } = usePersonDetails(patientUuid);
  const start = useStartConsultation(patientUuid);
  const [last] = consultations;
  // The clinician records the diagnosis on the consultation (AR-167): the latest one, edited, or a first one.
  const updateDiagnosis = () => (last ? start.edit(last.uuid) : start.start());

  const fields = [
    {
      id: 'last',
      label: t('lastConsultation', 'Last consultation'),
      value: last ? formatDate(last.date, { time: false, noToday: true }) : '--',
    },
    {
      id: 'next',
      label: t('nextCardiologyReview', 'Next cardiology review'),
      value: nextDue ? formatDate(parseDate(nextDue), { time: false, noToday: true }) : '--',
      overdue: Boolean(nextDue) && daysUntil(nextDue) < 0,
    },
    { id: 'diagnosis', label: t('diagnosis', 'Diagnosis'), value: diagnosis ?? '--' },
    {
      id: 'cardiac-clinic',
      label: t('cardiacClinic', 'Cardiac clinic'),
      value: attributes.get(contactCard.attributeTypes.cardiacClinic) || '--',
    },
  ];

  return (
    <div className={styles.card}>
      <CardHeader title={t('consultationVisits', 'Consultation visits')}>
        {start && (
          <Button
            kind="ghost"
            size="sm"
            renderIcon={(props) => <AddIcon size={16} {...props} />}
            disabled={start.isOpening}
            onClick={start.start}
          >
            {t('startConsultation', 'Start consultation')}
          </Button>
        )}
      </CardHeader>
      {isLoading || diagnosisLoading ? (
        <SkeletonText paragraph lineCount={2} />
      ) : (
        <dl className={styles.fields}>
          {fields.map((field) => (
            <div
              key={field.id}
              className={field.id === 'diagnosis' ? `${styles.field} ${styles.wideField}` : styles.field}
            >
              <dt className={styles.label}>{field.label}</dt>
              <dd
                className={styles.value}
                data-testid={`consultation-${field.id}`}
                data-overdue={String(Boolean(field.overdue))}
              >
                {field.value}
                {field.id === 'last' && last && start && (
                  <Button
                    kind="ghost"
                    size="sm"
                    className={styles.fieldAction}
                    renderIcon={(props) => <EditIcon size={16} {...props} />}
                    disabled={start.isOpening}
                    aria-label={t('editLastConsultation', 'Edit last consultation')}
                    onClick={() => start.edit(last.uuid)}
                  >
                    {t('edit', 'Edit')}
                  </Button>
                )}
                {field.id === 'diagnosis' && start && (
                  <Button
                    kind="ghost"
                    size="sm"
                    className={styles.fieldAction}
                    renderIcon={(props) => <EditIcon size={16} {...props} />}
                    disabled={start.isOpening}
                    onClick={updateDiagnosis}
                  >
                    {diagnosis ? t('updateDiagnosis', 'Update diagnosis') : t('recordDiagnosis', 'Record diagnosis')}
                  </Button>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
