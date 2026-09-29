import React from 'react';
import { ActDashboardLink } from '../access/act-dashboard-link.component';
import { screenPositiveDashboardMeta } from './screen-positive.meta';

export default function ScreenPositiveDashboardLink() {
  return <ActDashboardLink screen="screenPositive" meta={screenPositiveDashboardMeta} />;
}
