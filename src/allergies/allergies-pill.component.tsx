import React from 'react';
import { useTranslation } from 'react-i18next';
import { Tag, Toggletip, ToggletipButton, ToggletipContent } from '@carbon/react';
import { ConfigurableLink, useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { day } from '../consultations/repeated-lists.component';
import { pillsClassName } from '../patient-status/status-pill.component';
import { useAllergies } from './allergies.resource';

const shown = 2;

/**
 * The patient banner's current allergies: nothing while they load, and never "none" when they could not be read.
 */
export default function AllergiesPill({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const config = useConfig<Config>();
  const { current: allergies, noKnownAllergies, error, isLoading } = useAllergies(patientUuid, config);
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
  if (!allergies.length && noKnownAllergies) {
    return (
      <span className={pillsClassName}>
        <Tag type="outline" size="md" data-testid="allergies-pill" data-tone="no-known-allergies">
          {t('noKnownAllergies', 'No known allergies')}
        </Tag>
      </span>
    );
  }
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
          <ConfigurableLink to={`\${openmrsSpaBase}/patient/${patientUuid}/chart/act-allergies`}>
            {t('reviewInAllergies', 'Review in Allergies')}
          </ConfigurableLink>
        </ToggletipContent>
      </Toggletip>
    </span>
  );
}
