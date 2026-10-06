import React from 'react';
import { ActDashboardLink } from '../access/act-dashboard-link.component';
import { useHoldsActHome } from '../access/holds-act-home';
import { communityHomeDashboardMeta } from './community-home.meta';

/** Home's entry in the left nav, left out for a user whose home is ACT home. */
export default function CommunityHomeDashboardLink() {
  return useHoldsActHome() ? null : <ActDashboardLink meta={communityHomeDashboardMeta} />;
}
