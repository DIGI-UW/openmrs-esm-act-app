import React from 'react';
import { ActDashboardLink } from '../access/act-dashboard-link.component';
import { actHomeDashboardMeta } from './act-home.meta';

export default function ActHomeDashboardLink() {
  return <ActDashboardLink screen="home" meta={actHomeDashboardMeta} />;
}
