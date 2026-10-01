import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActDashboardLink } from '../access/act-dashboard-link.component';
import { screenPositiveDashboardMeta } from './screen-positive.meta';

export default function ScreenPositiveDashboardLink() {
  const { t } = useTranslation();
  // The left nav takes the prototype's name; the page and its ACT home card keep the full name.
  return (
    <ActDashboardLink
      screen="screenPositive"
      meta={{ ...screenPositiveDashboardMeta, title: t('screenPositiveNav', 'Screen positive pending') }}
    />
  );
}
