import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActDashboardLink } from '../access/act-dashboard-link.component';
import { useHoldsActHome } from '../access/holds-act-home';
import { dueForProphylaxisDashboardMeta } from './due-for-prophylaxis.meta';

/** The due list's entry in the left nav, left out for a user whose home is ACT home, where the registry shows who is due. */
export default function DueForProphylaxisDashboardLink() {
  const { t } = useTranslation();
  const holdsActHome = useHoldsActHome();
  if (holdsActHome) {
    return null;
  }
  return (
    <ActDashboardLink
      meta={{ ...dueForProphylaxisDashboardMeta, title: t('dueForProphylaxis', 'Due for prophylaxis') }}
    />
  );
}
