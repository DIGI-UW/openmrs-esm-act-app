import React from 'react';
import { useTranslation } from 'react-i18next';
import { ProgrammeReport } from './programme-report.component';

/** Facility reports, the data clerk's view of the Reports page. */
export default function FacilityReports() {
  const { t } = useTranslation();
  return <ProgrammeReport title={t('facilityReports', 'Facility reports')} />;
}
