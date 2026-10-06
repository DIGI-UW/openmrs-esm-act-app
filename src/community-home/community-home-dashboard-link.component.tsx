import React from 'react';
import { ActDashboardLink } from '../access/act-dashboard-link.component';
import { useAdministersFromActHome } from '../access/administers-from-act-home';
import { communityHomeDashboardMeta } from './community-home.meta';

/** Home's entry in the left nav, left out for an administrator who works from ACT home. */
export default function CommunityHomeDashboardLink() {
  return useAdministersFromActHome() ? null : <ActDashboardLink meta={communityHomeDashboardMeta} />;
}
