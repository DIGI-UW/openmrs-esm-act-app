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

/** An ACT screen's page: white to the foot of the window, as O3's home dashboards are, however short its content. */
export function ActPage({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.page} data-testid="act-page">
      {children}
    </div>
  );
}
