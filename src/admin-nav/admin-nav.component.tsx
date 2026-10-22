import React from 'react';
import { useTranslation } from 'react-i18next';
import { ConfigurableLink, useConfig, userHasAccess, useSession } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import {
  PRIVILEGE_DOWNLOAD_DATA,
  PRIVILEGE_DOWNLOAD_RESEARCH_DATA,
  PRIVILEGE_EDIT_USERS,
  PRIVILEGE_MANAGE_LOCATIONS,
  PRIVILEGE_REFRESH_FLAGS,
  PRIVILEGE_STUDIES,
  PRIVILEGE_VIEW_AUDIT_LOGS,
  PRIVILEGE_VIEW_READ_AUDIT_LOGS,
  PRIVILEGE_VIEW_SECURITY_AUDIT_LOGS,
} from '../constants';
import styles from './admin-nav.scss';

/**
 * The left nav's Admin section: each page for a user holding any of its privileges, and no heading when there is none.
 */
export default function AdminNav() {
  const { t } = useTranslation();
  const { adminLinks } = useConfig<Config>();
  const { user } = useSession();
  const links = [
    { privilege: PRIVILEGE_EDIT_USERS, to: adminLinks.usersUrl, label: t('usersAndRoles', 'Users and roles') },
    {
      privilege: [PRIVILEGE_VIEW_AUDIT_LOGS, PRIVILEGE_VIEW_READ_AUDIT_LOGS, PRIVILEGE_VIEW_SECURITY_AUDIT_LOGS],
      to: adminLinks.logsUrl,
      label: t('logs', 'Logs'),
    },
    { privilege: PRIVILEGE_MANAGE_LOCATIONS, to: adminLinks.clinicsUrl, label: t('clinics', 'Clinics') },
    { privilege: PRIVILEGE_STUDIES, to: adminLinks.studiesUrl, label: t('studies', 'Studies') },
    {
      privilege: PRIVILEGE_REFRESH_FLAGS,
      to: adminLinks.refreshFlagsUrl,
      label: t('flagsAndAdherence', 'Flags and adherence'),
    },
    {
      privilege: [PRIVILEGE_DOWNLOAD_DATA, PRIVILEGE_DOWNLOAD_RESEARCH_DATA],
      to: adminLinks.downloadUrl,
      label: t('downloadData', 'Download data'),
    },
  ].filter(({ privilege }) => user && [privilege].flat().some((one) => userHasAccess(one, user)));

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
