import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActDashboardLink } from '../access/act-dashboard-link.component';
import { screenPositiveDashboardMeta } from './screen-positive.meta';

export default function ScreenPositiveDashboardLink() {
  const { t } = useTranslation();
  // The left nav's label is short, to fit on one line; the page and its ACT home card keep the full name.
  return (
    <ActDashboardLink
      screen="screenPositive"
      meta={{ ...screenPositiveDashboardMeta, title: t('screenPositiveNav', 'Screen positive') }}
    />
  );
}
