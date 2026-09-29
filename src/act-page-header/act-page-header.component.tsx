import React from 'react';
import { PageHeader, PageHeaderContent } from '@openmrs/esm-framework';
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
      {actions && <div className={styles.actions}>{actions}</div>}
    </PageHeader>
  );
}
