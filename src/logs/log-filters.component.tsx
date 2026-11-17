import React, { useState } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { TextInput } from '@carbon/react';
import { formatDate, OpenmrsDatePicker } from '@openmrs/esm-framework';
import { PAGE_SIZES, type Paging, type SharedQuery } from './logs.resource';
import styles from './logs.scss';

/** The filters the page keeps in its URL: the tab, the three every tab shares, and each tab's own. */
export const logFilterKeys = ['tab', 'user', 'from', 'to', 'kind', 'form', 'patient', 'identifiers'] as const;

export type LogFilterKey = (typeof logFilterKeys)[number];
export type LogFilters = Record<LogFilterKey, string>;

/** The shared filters as the requests take them: the username and ISO dates, left out when empty. */
export const sharedQuery = (filters: LogFilters): SharedQuery => ({
  username: filters.user.trim() || undefined,
  startDate: filters.from || undefined,
  endDate: filters.to || undefined,
});

/** The filters a download records: those set, by name. */
export const setFilters = (filters: LogFilters, keys: ReadonlyArray<LogFilterKey>) =>
  Object.fromEntries(keys.filter((key) => filters[key]).map((key) => [key, filters[key]]));

const isoDate = (date: Date | null | undefined) =>
  date && dayjs(date).isValid() ? dayjs(date).format('YYYY-MM-DD') : '';

/** A log's page, from the first again whenever its query changes, in the same render as the change. */
export function useLogPaging(queryKey: string) {
  const [stored, setStored] = useState<Paging & { key: string }>({
    key: queryKey,
    startIndex: 0,
    limit: PAGE_SIZES[0],
  });
  const paging: Paging = { startIndex: stored.key === queryKey ? stored.startIndex : 0, limit: stored.limit };
  const setPaging = (next: Paging) => setStored({ ...next, key: queryKey });
  return [paging, setPaging] as const;
}

/**
 * What the list covers when no From is set: ACT Core reads the last 12 months and names the first day, so the
 * reader knows older entries need a From date.
 */
export function LogWindowNote({ from, filters }: { from: string | undefined; filters: LogFilters }) {
  const { t } = useTranslation();
  if (filters.from || !from) {
    return null;
  }
  return (
    <p className={styles.windowNote} data-testid="log-window">
      {t('showingSince', 'Showing since {{date}}; set From to go further back', {
        date: formatDate(dayjs(from).toDate(), { time: false, noToday: true }),
      })}
    </p>
  );
}

/** The filter row: the user and dates every tab has, then the tab's own, then its actions on the right. */
export function LogFilterBar({
  filters,
  onChange,
  children,
  actions,
}: {
  filters: LogFilters;
  onChange: (change: Partial<LogFilters>) => void;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const backwards = !!filters.from && !!filters.to && filters.from > filters.to;
  return (
    <div className={styles.filterBar}>
      <div className={styles.filters}>
        <TextInput
          id="logs-user"
          labelText={t('user', 'User')}
          placeholder={t('anyUser', 'Any user')}
          value={filters.user}
          onChange={(event) => onChange({ user: event.target.value })}
        />
        <OpenmrsDatePicker
          id="logs-from"
          labelText={t('fromDate', 'From')}
          value={filters.from ? dayjs(filters.from).toDate() : null}
          onChange={(date) => onChange({ from: isoDate(date) })}
        />
        <OpenmrsDatePicker
          id="logs-to"
          labelText={t('toDate', 'To')}
          value={filters.to ? dayjs(filters.to).toDate() : null}
          invalid={backwards}
          invalidText={t('endBeforeStart', 'The end is before the start')}
          onChange={(date) => onChange({ to: isoDate(date) })}
        />
        {children}
      </div>
      {actions && <div className={styles.filterActions}>{actions}</div>}
    </div>
  );
}
