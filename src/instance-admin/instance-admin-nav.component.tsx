import React from 'react';
import { useTranslation } from 'react-i18next';
import { ConfigurableLink, useConfig } from '@openmrs/esm-framework';
import { useHoldsActHome } from '../access/holds-act-home';
import { type Config } from '../config-schema';
import { useRolePermissionsAssigned } from '../role-permissions/role-permissions-dashboard-link.component';

/**
 * The Instance admin's Forms & sites, and Role permissions when its page's link is assigned; Studies is in Admin.
 * Left out for a user whose home is ACT home, as the Instance admin's Home link is.
 */
export default function InstanceAdminNav() {
  const { t } = useTranslation();
  const { instanceAdminQuickActions } = useConfig<Config>();
  const rolePermissionsAssigned = useRolePermissionsAssigned();
  if (useHoldsActHome()) {
    return null;
  }
  const links = [
    { to: instanceAdminQuickActions.formsAndSitesUrl, label: t('formsAndSites', 'Forms & sites') },
    ...(rolePermissionsAssigned
      ? [{ to: instanceAdminQuickActions.rolePermissionsUrl, label: t('rolePermissions', 'Role permissions') }]
      : []),
  ];
  return (
    <div>
      {links.map(({ to, label }) => (
        <ConfigurableLink key={to} to={to} className="cds--side-nav__link">
          {label}
        </ConfigurableLink>
      ))}
    </div>
  );
}
