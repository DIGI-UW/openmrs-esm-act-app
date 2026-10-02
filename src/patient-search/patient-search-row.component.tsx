import React from 'react';
import { useTranslation } from 'react-i18next';
import { InlineLoading, Tag } from '@carbon/react';
import { age, formatDate, parseDate, useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { useProphylaxisSummary } from '../prophylaxis/prophylaxis.resource';
import { type SearchedPatient } from './patient-search.resource';
import styles from './patient-search-panel.scss';

function StatusTag({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const { summary } = useProphylaxisSummary(patientUuid);
  switch (summary?.status) {
    case 'overdue':
      return <Tag type="red">{t('overdue', 'Overdue')}</Tag>;
    case 'dueToday':
      return <Tag type="blue">{t('dueToday', 'Due today')}</Tag>;
    case 'ok':
    case 'dueSoon':
      return <Tag type="gray">{t('upToDate', 'Up to date')}</Tag>;
    default:
      return null;
  }
}

/** One patient in the search panel: initials, name, demographics, ACT ID and prophylaxis status. */
export function PatientSearchRow({
  patient,
  onSelect,
  busy = false,
  disabled = false,
}: {
  patient: SearchedPatient;
  onSelect: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const { actIdentifierType } = useConfig<Config>();
  const name = patient.person.display;
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const actId = patient.identifiers.find((identifier) => identifier.identifierType.uuid === actIdentifierType);
  const sex = { F: t('female', 'Female'), M: t('male', 'Male') }[patient.person.gender] ?? patient.person.gender;
  const details = [
    sex,
    patient.person.birthdate ? age(patient.person.birthdate) : null,
    patient.person.birthdate ? formatDate(parseDate(patient.person.birthdate), { time: false, noToday: true }) : null,
    actId ? `${t('actId', 'ACT ID')} ${actId.identifier}` : null,
  ].filter(Boolean);

  return (
    <li>
      <button type="button" className={styles.row} onClick={onSelect} disabled={disabled} aria-busy={busy}>
        <span className={styles.initials} aria-hidden>
          {initials}
        </span>
        <span className={styles.who}>
          <span className={styles.name}>{name}</span>
          <span className={styles.details}>{details.join(' · ')}</span>
        </span>
        {busy ? (
          <InlineLoading description={t('openingChart', 'Opening their chart')} />
        ) : (
          <StatusTag patientUuid={patient.uuid} />
        )}
      </button>
    </li>
  );
}
