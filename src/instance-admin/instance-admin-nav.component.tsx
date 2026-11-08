import React from 'react';
import { useTranslation } from 'react-i18next';
import { ConfigurableLink, useAssignedExtensions, useConfig } from '@openmrs/esm-framework';
import { useHoldsActHome } from '../access/holds-act-home';
import { type Config } from '../config-schema';

/**
 * The Instance admin's Forms & sites and Role permissions, to their quick-action URLs; Studies is in the Admin section.
 * Role permissions shows when its page's link is assigned, as the Admin section's links do. Left out for a user whose
 * home is ACT home, as the Instance admin's Home link is.
 */
export default function InstanceAdminNav() {
  const { t } = useTranslation();
  const { instanceAdminQuickActions } = useConfig<Config>();
  const rolePermissionsAssigned = useAssignedExtensions('homepage-dashboard-slot').some(
    ({ name }) => name === 'act-role-permissions-dashboard-link',
  );
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
