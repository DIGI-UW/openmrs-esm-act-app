import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActDashboardLink } from '../access/act-dashboard-link.component';
import { dashboardMeta } from './dashboard.meta';

/** The Dashboard's entry in the left nav. */
export default function DashboardLink() {
  const { t } = useTranslation();
  return <ActDashboardLink meta={{ ...dashboardMeta, title: t('dashboard', 'Dashboard') }} />;
}
