import React from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable } from '@carbon/react/icons';
import { useConfig } from '@openmrs/esm-framework';
import { ActHomeCard } from '../act-home/act-home-card.component';
import { type ClinicLimit, useClinicLimit } from '../clinic-limit';
import { type Config } from '../config-schema';
import { QuickActionTile } from '../quick-actions/quick-action-tile.component';
import tileStyles from '../quick-actions/quick-actions.scss';
import { reportsFor } from './report-catalogue';
import styles from './report-view.scss';

/** Whose rows a limited administrator's tables show, or why they show none. */
function useHeldTo(limit: ClinicLimit) {
  const { t } = useTranslation();
  if (limit.status !== 'ready') {
    return null;
  }
  if (!limit.uuids.length) {
    return t('reportsNoClinic', 'Your account holds no clinic, so these tables show no rows.');
  }
  if (!limit.names.length) {
    return t('reportsClinicsUnread', 'Your clinics could not be read, so these tables show no rows.');
  }
  return `${t('reportsHeldTo', "These tables show your clinics' rows:")} ${limit.names.join(', ')}.`;
}

/** The Reports page's reports that open as a table, each a tile; nothing when none is offered. */
export function ReportCatalogueCard() {
  const { t } = useTranslation();
  const { reportCatalogue } = useConfig<Config>();
  const limit = useClinicLimit();
  const heldTo = useHeldTo(limit);
  const entries = reportsFor(reportCatalogue, limit);
  if (!entries.length) {
    return null;
  }
  return (
    <ActHomeCard title={t('allReports', 'All reports')}>
      <div className={styles.catalogue}>
        <p className={styles.description}>
          {t('allReportsDescription', 'Open a report as a table to sort and search it, then download what you see.')}
        </p>
        {heldTo && <p className={styles.heldTo}>{heldTo}</p>}
        <div className={tileStyles.tiles}>
          {entries.map((entry) => (
            <QuickActionTile
              key={entry.id}
              label={entry.label}
              Icon={DataTable}
              subtitle={entry.description}
              footer={t('opensAsTable', 'Opens as a table · Download CSV')}
              to={`\${openmrsSpaBase}/home/act-report?report=${encodeURIComponent(entry.id)}`}
            />
          ))}
        </div>
      </div>
    </ActHomeCard>
  );
}
