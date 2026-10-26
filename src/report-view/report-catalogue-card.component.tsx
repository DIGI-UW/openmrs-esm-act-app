import React from 'react';
import { useTranslation } from 'react-i18next';
import { ConfigurableLink, useConfig } from '@openmrs/esm-framework';
import { ActHomeCard } from '../act-home/act-home-card.component';
import { useClinicLimit } from '../clinic-limit';
import { type Config } from '../config-schema';
import { reportsFor } from './report-catalogue';
import styles from './report-view.scss';

/** The Reports page's list of reports that open as a table, each with its description; nothing when none is offered. */
export function ReportCatalogueCard() {
  const { t } = useTranslation();
  const { reportCatalogue } = useConfig<Config>();
  const entries = reportsFor(reportCatalogue, useClinicLimit());
  if (!entries.length) {
    return null;
  }
  return (
    <ActHomeCard title={t('allReports', 'All reports')}>
      <p className={styles.description}>
        {t('allReportsDescription', 'Open a report as a table to sort and search it, then download what you see.')}
      </p>
      <ul className={styles.catalogue}>
        {entries.map((entry) => (
          <li key={entry.id} className={styles.catalogueItem}>
            <ConfigurableLink to={`\${openmrsSpaBase}/home/act-report?report=${encodeURIComponent(entry.id)}`}>
              {entry.label}
            </ConfigurableLink>
            <span className={styles.description}>{entry.description}</span>
          </li>
        ))}
      </ul>
    </ActHomeCard>
  );
}
