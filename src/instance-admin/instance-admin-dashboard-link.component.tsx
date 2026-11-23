import React from 'react';
import { useSession } from '@openmrs/esm-framework';
import { ActDashboardLink } from '../access/act-dashboard-link.component';
import { useHoldsActHome } from '../access/holds-act-home';
import { PRIVILEGE_INSTANCE_ADMIN } from '../constants';
import { instanceAdminDashboardMeta } from './instance-admin.meta';

/**
 * Whether ACT home stands in for the Instance admin's Home and nav: the user's home is ACT home and no role of theirs
 * holds App: act.instanceAdmin, as for a super user, who passes the privilege check without holding it.
 */
export function useActHomeReplacesInstanceAdmin() {
  const { user } = useSession();
  const holdsActHome = useHoldsActHome();
  return holdsActHome && !user?.privileges?.some(({ display }) => display === PRIVILEGE_INSTANCE_ADMIN);
}

/** Home's entry in the left nav for an Instance admin, left out where ACT home stands in for it. */
export default function InstanceAdminDashboardLink() {
  return useActHomeReplacesInstanceAdmin() ? null : <ActDashboardLink meta={instanceAdminDashboardMeta} />;
}
