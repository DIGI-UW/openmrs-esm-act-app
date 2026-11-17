import React from 'react';
import { ActDashboardLink } from '../access/act-dashboard-link.component';
import { useHoldsActHome } from '../access/holds-act-home';
import { instanceAdminDashboardMeta } from './instance-admin.meta';

/** Home's entry in the left nav for an Instance admin, left out for a user whose home is ACT home. */
export default function InstanceAdminDashboardLink() {
  return useHoldsActHome() ? null : <ActDashboardLink meta={instanceAdminDashboardMeta} />;
}
