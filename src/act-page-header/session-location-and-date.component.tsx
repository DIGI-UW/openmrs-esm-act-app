import React from 'react';
import { Calendar, Location } from '@carbon/react/icons';
import { formatDate, useSession } from '@openmrs/esm-framework';
import styles from './session-location-and-date.scss';

/** A page header's session location and today's date, as Home's and the reports pages' headers show them. */
export function SessionLocationAndDate() {
  const { sessionLocation } = useSession();
  return (
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
  );
}
