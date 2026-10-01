import React from 'react';
import { useTranslation } from 'react-i18next';
import { Tag } from '@carbon/react';
import { useProphylaxisSummary } from './prophylaxis.resource';

interface ProphylaxisStatusTagProps {
  patientUuid: string;
  patient?: fhir.Patient;
}

/** The patient banner's Overdue or Due today tag; up to date, unknown, unreadable or deceased shows none. */
export default function ProphylaxisStatusTag({ patientUuid, patient }: ProphylaxisStatusTagProps) {
  const { t } = useTranslation();
  const deceased = Boolean(patient?.deceasedBoolean || patient?.deceasedDateTime);
  const { summary } = useProphylaxisSummary(deceased ? null : patientUuid);

  if (summary?.status === 'overdue') {
    return (
      <Tag data-testid="prophylaxis-status" type="red">
        {t('overdue', 'Overdue')}
      </Tag>
    );
  }
  if (summary?.status === 'dueToday') {
    return (
      <Tag data-testid="prophylaxis-status" type="blue">
        {t('dueToday', 'Due today')}
      </Tag>
    );
  }
  return null;
}
