import React from 'react';
import { SkeletonText } from '@carbon/react';
import styles from './summary-card.scss';

export interface SummaryField {
  label: string;
  value: string | null;
}

/** A summary card's fields, label over value, or a skeleton while they load; a value not recorded shows --. */
export function SummaryFields({ fields }: { fields: Array<SummaryField> | null }) {
  if (!fields) {
    return <SkeletonText paragraph lineCount={2} />;
  }
  return (
    <dl className={styles.fields}>
      {fields.map((field) => (
        <div key={field.label} className={styles.field}>
          <dt className={styles.label}>{field.label}</dt>
          <dd className={styles.value}>{field.value || '--'}</dd>
        </div>
      ))}
    </dl>
  );
}
