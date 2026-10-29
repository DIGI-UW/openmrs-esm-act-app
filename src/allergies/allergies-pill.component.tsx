import React from 'react';
import { useTranslation } from 'react-i18next';
import { Tag, Toggletip, ToggletipButton, ToggletipContent } from '@carbon/react';
import { ConfigurableLink, useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { useConsultations } from '../consultations/consultations.resource';
import { pillsClassName } from '../patient-status/status-pill.component';
import { allergiesOf } from './allergies.resource';

const shown = 2;
const day = (date: string) => (date ? new Date(date).toLocaleDateString() : '');

/**
 * The patient banner's allergies, which the consultations record: the first two named, the rest behind a click with
 * the dates they were added, and a penicillin allergy in red. Nothing while they load, and never none when unread.
 */
export default function AllergiesPill({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const { consultations } = useConfig<Config>();
  const { encounters, error, isLoading } = useConsultations(patientUuid);
  if (isLoading) {
    return null;
  }
  if (error) {
    return (
      <span className={pillsClassName}>
        <Tag type="outline" size="md" data-testid="allergies-pill" data-tone="unavailable">
          {t('allergiesUnavailable', 'Allergies unavailable')}
        </Tag>
      </span>
    );
  }
  const allergies = allergiesOf(encounters, consultations);
  if (!allergies.length) {
    return (
      <span className={pillsClassName}>
        <Tag type="outline" size="md" data-testid="allergies-pill" data-tone="none">
          {t('allergiesNotRecorded', 'Allergies not recorded')}
        </Tag>
      </span>
    );
  }
  const penicillin = allergies.some((one) => one.isPenicillin);
  const names = allergies.slice(0, shown).map((one) => one.name);
  const more = allergies.length - names.length;
  const label = t('allergiesNamed', 'Allergies: {{names}}', {
    names: more ? `${names.join(', ')}, +${more}` : names.join(', '),
    interpolation: { escapeValue: false },
  });
  return (
    <span className={pillsClassName} data-testid="allergies-pill" data-tone={penicillin ? 'penicillin' : 'other'}>
      <Toggletip>
        <ToggletipButton label={t('allAllergies', 'All allergies')}>
          <Tag type={penicillin ? 'red' : 'gray'} size="md">
            {label}
          </Tag>
        </ToggletipButton>
        <ToggletipContent>
          <ul aria-label={t('allergies', 'Allergies')}>
            {allergies.map((one) => (
              <li key={one.key}>
                {one.name}
                {one.added ? ` (${t('allergyAdded', 'added {{date}}', { date: day(one.added) })})` : ''}
              </li>
            ))}
          </ul>
          <ConfigurableLink to={`\${openmrsSpaBase}/patient/${patientUuid}/chart/act-consultations`}>
            {t('reviewInConsultationVisits', 'Review in Consultation visits')}
          </ConfigurableLink>
        </ToggletipContent>
      </Toggletip>
    </span>
  );
}
