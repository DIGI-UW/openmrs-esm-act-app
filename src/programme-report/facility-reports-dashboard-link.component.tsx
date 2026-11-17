import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActDashboardLink } from '../access/act-dashboard-link.component';
import { useHoldsActHome } from '../access/holds-act-home';
import { facilityReportsDashboardMeta } from './programme-report.meta';

/** Facility reports' entry in the left nav, left out for a user whose home is ACT home, who has Reports. */
export default function FacilityReportsDashboardLink() {
  const { t } = useTranslation();
  const holdsActHome = useHoldsActHome();
  if (holdsActHome) {
    return null;
  }
  return (
    <ActDashboardLink meta={{ ...facilityReportsDashboardMeta, title: t('facilityReports', 'Facility reports') }} />
  );
}
