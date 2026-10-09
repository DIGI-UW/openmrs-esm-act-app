import React, { useMemo } from 'react';
import { type TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { formatDate, useConfig } from '@openmrs/esm-framework';
import { rowFlags } from '../registry/registry-filters';
import { useRegistryReport } from '../registry/registry.resource';
import { type ReportRow } from '../reports/report-dataset.resource';
import { parseReportDate } from '../reports/report-date';
import { useRhdFlagList } from '../rhd-flags/rhd-flag-lists.resource';
import { type FlagWorklistConfig } from './flag-worklists';
import { Worklist, type WorklistState, WorklistTable } from './worklist.component';

const DAY_MS = 24 * 60 * 60 * 1000;

/** How long the patient has been on the flag's list, from the registry report's name=YYYY-MM-DD pairs. */
function onListSince(t: TFunction, row: ReportRow, flag: string) {
  const pair = String(row.rhd_flag_dates ?? '')
    .split('|')
    .find((p) => p.slice(0, p.lastIndexOf('=')) === flag);
  const since = pair && parseReportDate(pair.slice(pair.lastIndexOf('=') + 1));
  if (!since) {
    return '';
  }
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return t('onListForDays', 'On the list for {{count}} days', {
    count: Math.round((today.getTime() - since.getTime()) / DAY_MS),
  });
}

/** The date the patient is due by: "Overdue · was due …" once it has passed, else "Due …". */
function dueBy(t: TFunction, value: unknown) {
  const due = parseReportDate(value);
  if (!due) {
    return '';
  }
  const now = new Date();
  const date = formatDate(due, { time: false, noToday: true });
  return due < new Date(now.getFullYear(), now.getMonth(), now.getDate())
    ? t('overdueWasDue', 'Overdue · was due {{date}}', { date })
    : t('dueOn', 'Due {{date}}', { date });
}

/**
 * A worklist of the registry patients on one flag's list, as its extension's config names the flag, its tile counting
 * the patients it lists; nothing where the flag has no list.
 */
export default function FlagWorklist(state: WorklistState) {
  const { t } = useTranslation();
  const { flag, title, tone, dueDateColumn } = useConfig<FlagWorklistConfig>();
  const { list, isLoading, error } = useRhdFlagList(flag);
  const registry = useRegistryReport();
  const entries = useMemo(
    () =>
      registry.rows
        .filter((row) => rowFlags(row).includes(flag))
        .map((row) => ({
          row,
          why: dueDateColumn ? dueBy(t, row[dueDateColumn]) : onListSince(t, row, flag),
        })),
    [registry.rows, flag, dueDateColumn, t],
  );
  if (!isLoading && !error && !list) {
    return null;
  }
  return (
    <Worklist
      state={state}
      title={title}
      tone={tone}
      count={isLoading || registry.isLoading ? undefined : entries.length}
      error={error ?? registry.error}
      list={
        <WorklistTable
          title={title}
          csvName={flag.toLowerCase().replace(/\W+/g, '-')}
          entries={entries}
          isLoading={registry.isLoading}
          error={registry.error}
        />
      }
    />
  );
}
