import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActDashboardLink } from '../access/act-dashboard-link.component';
import { dueForProphylaxisDashboardMeta } from './due-for-prophylaxis.meta';

export default function DueForProphylaxisDashboardLink() {
  const { t } = useTranslation();
  return (
    <ActDashboardLink
      meta={{ ...dueForProphylaxisDashboardMeta, title: t('dueForProphylaxis', 'Due for prophylaxis') }}
    />
  );
}
