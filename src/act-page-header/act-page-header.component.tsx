import React from 'react';
import { PageHeader, PageHeaderContent } from '@openmrs/esm-framework';
import { SessionLocationAndDate } from './session-location-and-date.component';
import styles from './act-page-header.scss';

export function ActPageHeader({
  title,
  illustration,
  actions,
}: {
  title: string;
  illustration: React.ReactElement;
  actions?: React.ReactNode;
}) {
  return (
    <PageHeader className={styles.header} data-testid="act-page-header">
      <PageHeaderContent title={title} illustration={illustration} />
      <div className={styles.actions}>
        {actions}
        <SessionLocationAndDate />
      </div>
    </PageHeader>
  );
}
