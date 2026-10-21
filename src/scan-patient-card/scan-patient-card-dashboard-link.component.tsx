import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActDashboardLink } from '../access/act-dashboard-link.component';
import { scanPatientCardDashboardMeta } from './scan-patient-card.meta';

export default function ScanPatientCardDashboardLink() {
  const { t } = useTranslation();
  return (
    <ActDashboardLink meta={{ ...scanPatientCardDashboardMeta, title: t('scanPatientCard', 'Scan patient card') }} />
  );
}
