import React from 'react';
import { useTranslation } from 'react-i18next';
import { Tag } from '@carbon/react';
import { type ReportRow } from '../reports/report-dataset.resource';
import styles from './registry.scss';

/** The registry report's BPG statuses, in the order the filter offers them. */
export const bpgStatuses = ['Covered', 'Deadline approaching', 'Not covered', 'No prescription'] as const;

/** A BPG status as the filter offers it; the tag words a due dose by its days instead. */
export function useBpgStatusLabel() {
  const { t } = useTranslation();
  return (status: string) =>
    ({
      Covered: t('covered', 'Covered'),
      'Deadline approaching': t('dueWithinSevenDays', 'Due within 7 days'),
      'Not covered': t('notCovered', 'Not covered'),
      'No prescription': t('noPrescription', 'No prescription'),
    })[status] ?? status;
}

const tagTypes = {
  Covered: 'green',
  'Deadline approaching': 'blue',
  'Not covered': 'red',
  'No prescription': 'warm-gray',
} as const;

/** A patient's BPG status as a coloured tag; a status the report does not give shows nothing. */
export function BpgStatusTag({ row }: { row: ReportRow }) {
  const { t } = useTranslation();
  const label = useBpgStatusLabel();
  const status = String(row.bpg_status ?? '');
  if (!(status in tagTypes)) {
    return null;
  }
  const days = row.days_until_due == null ? null : Number(row.days_until_due);
  const text =
    status !== 'Deadline approaching' || days == null
      ? label(status)
      : days === 0
        ? t('dueToday', 'Due today')
        : days === 1
          ? t('dueInOneDay', 'Due in 1 day')
          : t('dueInDays', 'Due in {{days}} days', { days });

  return (
    <Tag
      as="span"
      data-testid="bpg-status"
      type={tagTypes[status]}
      className={status === 'No prescription' ? styles.noPrescription : undefined}
      size="sm"
    >
      {text}
    </Tag>
  );
}
