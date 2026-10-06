import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActDashboardLink } from '../access/act-dashboard-link.component';
import { useAdministersFromActHome } from '../access/administers-from-act-home';
import { dueForProphylaxisDashboardMeta } from './due-for-prophylaxis.meta';

/** The due list's entry in the left nav, left out for an administrator who works from ACT home, whose registry shows who is due. */
export default function DueForProphylaxisDashboardLink() {
  const { t } = useTranslation();
  const administersFromActHome = useAdministersFromActHome();
  if (administersFromActHome) {
    return null;
  }
  return (
    <ActDashboardLink
      meta={{ ...dueForProphylaxisDashboardMeta, title: t('dueForProphylaxis', 'Due for prophylaxis') }}
    />
  );
}
