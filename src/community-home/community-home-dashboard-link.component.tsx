import React from 'react';
import { ActDashboardLink } from '../access/act-dashboard-link.component';
import { communityHomeDashboardMeta } from './community-home.meta';

export default function CommunityHomeDashboardLink() {
  return <ActDashboardLink meta={communityHomeDashboardMeta} />;
}
