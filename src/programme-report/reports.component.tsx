import React from 'react';
import { useTranslation } from 'react-i18next';
import { ProgrammeReport } from './programme-report.component';

/** Reports, in the clinician's and administrators' nav, with clinic filters. */
export default function Reports() {
  const { t } = useTranslation();
  return <ProgrammeReport title={t('reports', 'Reports')} clinicFilters />;
}
