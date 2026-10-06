import React from 'react';
import { useTranslation } from 'react-i18next';
import { ConfigurableLink, useConfig, userHasAccess, useSession } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { PRIVILEGE_EDIT_USERS, PRIVILEGE_MANAGE_LOCATIONS } from '../constants';
import styles from './admin-nav.scss';

/** The left nav's Admin section: each page for a user who may use it, and no heading when there is none. */
export default function AdminNav() {
  const { t } = useTranslation();
  const { adminLinks } = useConfig<Config>();
  const { user } = useSession();
  const links = [
    { privilege: PRIVILEGE_EDIT_USERS, to: adminLinks.usersUrl, label: t('usersAndRoles', 'Users and roles') },
    { privilege: PRIVILEGE_MANAGE_LOCATIONS, to: adminLinks.clinicsUrl, label: t('clinics', 'Clinics') },
  ].filter(({ privilege }) => user && userHasAccess(privilege, user));

  if (!links.length) {
    return null;
  }
  return (
    <div>
      <p className={styles.heading}>{t('admin', 'Admin')}</p>
      {links.map(({ to, label }) => (
        <ConfigurableLink key={to} to={to} className="cds--side-nav__link">
          {label}
        </ConfigurableLink>
      ))}
    </div>
  );
}
