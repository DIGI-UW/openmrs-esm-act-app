import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@carbon/react';
import { useConfig } from '@openmrs/esm-framework';
import { useMayEnterForm } from '../access/may-enter-form';
import { type Config } from '../config-schema';
import { type Column, day } from '../consultations/repeated-lists.component';
import { ChartListCard } from '../medications/medications.component';
import medicationStyles from '../medications/medications.scss';
import { useOpenFormInVisit } from '../visits/open-form-in-visit';
import { type Allergy, useAllergies } from './allergies.resource';
import styles from './allergies.scss';

/** An allergy as the Medications page reads a medicine: its name in bold, red for penicillin, then its reactions. */
function Details({ allergy }: { allergy: Allergy }) {
  const { t } = useTranslation();
  return (
    <>
      <strong
        className={allergy.isPenicillin ? styles.penicillin : undefined}
        data-tone={allergy.isPenicillin ? 'penicillin' : undefined}
      >
        {allergy.name}
      </strong>
      {allergy.reactions.length > 0 && (
        <>
          {' · '}
          <span className={medicationStyles.label}>{t('reaction', 'Reaction').toUpperCase()}</span>{' '}
          {allergy.reactions.join(', ')}
        </>
      )}
    </>
  );
}

/**
 * The patient chart's Allergies page, laid out as the Medications page: the current allergies and those resolved,
 * from consultations and RHD Allergies. Add opens RHD Allergies; Edit reopens a row's RHD Allergies record, and for a
 * row a consultation recorded opens a new one, as the consultation no longer asks for allergies.
 */
export default function Allergies({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const config = useConfig<Config>();
  const { current, past, error, isLoading } = useAllergies(patientUuid, config);
  const { open, isOpening } = useOpenFormInVisit(patientUuid);
  const mayRecord = useMayEnterForm(config.allergies.form);
  const add = mayRecord ? { add: () => open(config.allergies.form), isOpening } : null;
  const dateAdded: Column<Allergy> = { header: t('dateAdded', 'Date added'), text: (one) => day(one.added) };
  const details: Column<Allergy> = { header: t('details', 'Details'), text: (one) => <Details allergy={one} /> };
  const dateResolved: Column<Allergy> = {
    header: t('dateResolved', 'Date resolved'),
    text: (one) => day(one.resolved),
  };
  const edit: Column<Allergy> = {
    header: '',
    text: (one) =>
      mayRecord && (
        <Button
          kind="ghost"
          size="sm"
          disabled={isOpening}
          aria-label={t('editAllergy', 'Edit {{allergy}}', {
            allergy: one.name,
            interpolation: { escapeValue: false },
          })}
          onClick={() =>
            one.form === config.allergies.form
              ? open(config.allergies.form, undefined, one.encounterUuid)
              : open(config.allergies.form)
          }
        >
          {t('edit', 'Edit')}
        </Button>
      ),
  };
  return (
    <div className={medicationStyles.cards}>
      <ChartListCard
        title={t('currentAllergies', 'Current allergies')}
        lowercase={t('currentAllergiesLowercase', 'current allergies')}
        columns={[dateAdded, details, edit]}
        rows={current}
        isLoading={isLoading}
        error={error}
        add={add}
      />
      <ChartListCard
        title={t('pastAllergies', 'Past allergies')}
        lowercase={t('pastAllergiesLowercase', 'past allergies')}
        columns={[dateAdded, details, dateResolved, edit]}
        rows={past}
        isLoading={isLoading}
        error={error}
        add={add}
      />
    </div>
  );
}
