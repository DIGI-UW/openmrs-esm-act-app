import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActDashboardLink } from '../access/act-dashboard-link.component';
import { useHoldsWorklists } from '../access/holds-worklists';
import { screenPositiveDashboardMeta } from './screen-positive.meta';

/** Confirmatory echo due's entry in the left nav, left out for a user with the worklists, whose tile opens it. */
export default function ScreenPositiveDashboardLink() {
  const { t } = useTranslation();
  const holdsWorklists = useHoldsWorklists();
  if (holdsWorklists) {
    return null;
  }
  return (
    <ActDashboardLink
      meta={{ ...screenPositiveDashboardMeta, title: t('confirmatoryEchoDue', 'Confirmatory echo due') }}
    />
  );
}
