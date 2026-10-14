import React from 'react';
import { type DueTone } from './due-tone';
import styles from './status-pill.scss';

interface StatusPillProps {
  tone: DueTone;
  label: string;
  /** The full due date, on hover. */
  title?: string;
  testId?: string;
}

/** A coloured dot and its label: red overdue, yellow due within 48 hours, green fine. */
export function StatusPill({ tone, label, title, testId }: StatusPillProps) {
  return (
    <span className={`${styles.pill} ${styles[tone]}`} title={title} data-testid={testId} data-tone={tone}>
      <span className={styles.dot} aria-hidden />
      {label}
    </span>
  );
}

export const pillsClassName = styles.pills;
