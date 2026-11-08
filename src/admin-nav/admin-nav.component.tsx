import React from 'react';
import { useTranslation } from 'react-i18next';
import { ConfigurableLink, useAssignedExtensions, useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import styles from './admin-nav.scss';

/**
 * The left nav's Admin section: each page whose link extension the home dashboard assigns to the user, so routes.json
 * and a site's display conditions gate the link as they gate the page, and no heading when there is none.
 */
export default function AdminNav() {
  const { t } = useTranslation();
  const { adminLinks } = useConfig<Config>();
  const assigned = new Set(useAssignedExtensions('homepage-dashboard-slot').map(({ name }) => name));
  const links = [
    { extension: 'act-users-dashboard-link', to: adminLinks.usersUrl, label: t('usersAndRoles', 'Users and roles') },
    { extension: 'act-logs-dashboard-link', to: adminLinks.logsUrl, label: t('logs', 'Logs') },
    { extension: 'act-clinics-dashboard-link', to: adminLinks.clinicsUrl, label: t('clinics', 'Clinics') },
    { extension: 'act-studies-dashboard-link', to: adminLinks.studiesUrl, label: t('studies', 'Studies') },
    {
      extension: 'act-screening-counts-dashboard-link',
      to: adminLinks.screeningCountsUrl,
      label: t('screeningCounts', 'Screening counts'),
    },
    {
      extension: 'act-refresh-flags-dashboard-link',
      to: adminLinks.refreshFlagsUrl,
      label: t('flagsAndAdherence', 'Flags and adherence'),
    },
    { extension: 'act-download-dashboard-link', to: adminLinks.downloadUrl, label: t('downloadData', 'Download data') },
  ].filter(({ extension }) => assigned.has(extension));

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
