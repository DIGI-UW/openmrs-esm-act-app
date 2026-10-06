import React from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, Location } from '@carbon/react/icons';
import { formatDate, useSession } from '@openmrs/esm-framework';
import { HomeDashboard } from '../act-home/act-home-dashboard.component';
import { communityHomeWidgetsSlot } from './community-home.meta';
import styles from './community-home-dashboard.scss';

/** Home: its header with the session location and today's date, then the widgets assigned to its slot. */
export default function CommunityHomeDashboard() {
  const { t } = useTranslation();
  const { sessionLocation } = useSession();

  return (
    <HomeDashboard
      title={t('home', 'Home')}
      widgetsSlot={communityHomeWidgetsSlot}
      emptyMessage={t('noCommunityHomeWidgets', 'No widgets have been added to Home yet.')}
      headerActions={
        <div className={styles.headerMeta}>
          {sessionLocation?.display && (
            <span className={styles.metaItem}>
              <Location size={16} aria-hidden="true" />
              {sessionLocation.display}
            </span>
          )}
          <span className={styles.metaItem}>
            <Calendar size={16} aria-hidden="true" />
            {formatDate(new Date(), { time: false, noToday: true })}
          </span>
        </div>
      }
    />
  );
}
