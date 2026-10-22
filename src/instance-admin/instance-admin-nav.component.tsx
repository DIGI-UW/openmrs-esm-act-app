import React from 'react';
import { useTranslation } from 'react-i18next';
import { ConfigurableLink, useConfig } from '@openmrs/esm-framework';
import { useHoldsActHome } from '../access/holds-act-home';
import { type Config } from '../config-schema';

/**
 * The Instance admin's Forms & sites, Role permissions and Research participation, to their quick-action URLs; left out
 * for a user whose home is ACT home, as the Instance admin's Home link is.
 */
export default function InstanceAdminNav() {
  const { t } = useTranslation();
  const { instanceAdminQuickActions } = useConfig<Config>();
  if (useHoldsActHome()) {
    return null;
  }
  const links = [
    { to: instanceAdminQuickActions.formsAndSitesUrl, label: t('formsAndSites', 'Forms & sites') },
    { to: instanceAdminQuickActions.rolePermissionsUrl, label: t('rolePermissions', 'Role permissions') },
    {
      to: instanceAdminQuickActions.researchParticipationUrl,
      label: t('researchParticipation', 'Research participation'),
    },
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
