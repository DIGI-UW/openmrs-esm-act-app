import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActDashboardLink } from '../access/act-dashboard-link.component';
import { reportsDashboardMeta } from './programme-report.meta';

/** Reports' entry in the left nav. */
export default function ReportsDashboardLink() {
  const { t } = useTranslation();
  return <ActDashboardLink meta={{ ...reportsDashboardMeta, title: t('reports', 'Reports') }} />;
}
