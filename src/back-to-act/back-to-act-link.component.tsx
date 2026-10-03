import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@carbon/react';
import { ArrowLeftIcon, navigate } from '@openmrs/esm-framework';
import { type ActScreenName, readActReturn } from './act-return';
import styles from './back-to-act-link.scss';

/** Above every chart page: a link back to the ACT page the chart was opened from, filters and all. */
export default function BackToActLink() {
  const { t } = useTranslation();
  const actReturn = readActReturn();
  const labels: Record<ActScreenName, string> = {
    'act-home': t('backToActHome', 'Back to ACT home'),
    'act-registry': t('backToRegistry', 'Back to Registry'),
    'act-worklists': t('backToWorklists', 'Back to Worklists'),
    'act-waiting-list': t('backToWaitingList', 'Back to Procedural waiting list'),
    'act-screen-positive': t('backToScreenPositive', 'Back to Screen positive pending'),
  };
  if (!actReturn || !(actReturn.screen in labels)) {
    return null;
  }
  return (
    <div className={styles.backLink}>
      <Button
        kind="ghost"
        size="sm"
        renderIcon={(props) => <ArrowLeftIcon size={16} {...props} />}
        iconDescription=""
        onClick={() => navigate({ to: actReturn.path })}
      >
        {labels[actReturn.screen]}
      </Button>
    </div>
  );
}
