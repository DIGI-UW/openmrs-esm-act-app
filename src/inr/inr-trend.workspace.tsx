import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@carbon/react';
import { Workspace2, type Workspace2DefinitionProps } from '@openmrs/esm-framework';
import { useRecordInr } from './inr-reviews.component';
import InrTrendChart from './inr-trend-chart.component';
import { useInrReviews } from './inr.resource';
import styles from './inr-window.scss';

type WorkspaceProps = Workspace2DefinitionProps<object, object, { patientUuid: string }>;

export default function InrTrendWorkspace({ groupProps: { patientUuid } }: WorkspaceProps) {
  const { t } = useTranslation();
  const { reviews } = useInrReviews(patientUuid);
  const record = useRecordInr(patientUuid);
  const last = reviews.find((review) => review.inr !== null);

  return (
    <Workspace2 title={t('inrTrend', 'INR trend')}>
      <div className={styles.body}>
        <InrTrendChart patientUuid={patientUuid} />
        {record && (
          <div className={styles.actions}>
            {last && record.edit && (
              <Button kind="tertiary" size="sm" onClick={() => record.edit(last.encounterUuid, last.groupUuid)}>
                {t('editLatestInr', 'Edit INR')}
              </Button>
            )}
            <Button kind="ghost" size="sm" disabled={record.isOpening} onClick={record.record}>
              {t('recordNewInr', 'Record new INR')}
            </Button>
          </div>
        )}
      </div>
    </Workspace2>
  );
}
