import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Select, SelectItem, Tag } from '@carbon/react';
import { formatDate } from '@openmrs/esm-framework';
import { PRIVILEGE_DOWNLOAD_IDENTIFIERS } from '../constants';
import { type DownloadLogDetail, type DownloadLogEntry, useDownloadForms } from '../download/download.resource';
import { DownloadCsvButton } from '../table-filters/download-csv-button.component';
import {
  LogFilterBar,
  type LogFilters,
  LogWindowNote,
  setFilters,
  sharedQuery,
  useLogPaging,
} from './log-filters.component';
import { DetailLine, LogActionCell, LogTable, LogUserCell, type TagType } from './log-table.component';
import { fullTime, logTime } from './log-time';
import { useAllDownloads } from './logs.resource';
import styles from './logs.scss';

const downloadsFilterKeys = ['user', 'from', 'to', 'form', 'identifiers'] as const;

const identifierKinds = ['with', 'without', 'research'] as const;

type IdentifierKind = (typeof identifierKinds)[number];

const identifierKind = (detail: DownloadLogDetail | null): IdentifierKind =>
  detail?.identifiers ? 'with' : detail?.researchOnly ? 'research' : 'without';

const date = (iso: string) => formatDate(new Date(iso), { time: false, noToday: true });

/**
 * Every CSV that left ACT: Download data's forms, the registry and worklist lists and these logs, from ACT Core's
 * download log, with a summary line over every matching download.
 */
export function DownloadsTab({
  filters,
  onFilters,
}: {
  filters: LogFilters;
  onFilters: (change: Partial<LogFilters>) => void;
}) {
  const { t } = useTranslation();
  const { forms } = useDownloadForms();
  const query = useMemo(
    () => ({ ...sharedQuery(filters), form: filters.form || undefined, identifiers: filters.identifiers || undefined }),
    [filters],
  );
  const [paging, setPaging] = useLogPaging(JSON.stringify(query));
  const { page, error, isLoading } = useAllDownloads(query);
  const all = page?.results ?? [];

  const identifierLabels: Record<IdentifierKind, string> = {
    with: t('withIdentifiers', 'With identifiers'),
    without: t('withoutIdentifiers', 'Without identifiers'),
    research: t('researchParticipantsNoIdentifiers', 'Research participants, no identifiers'),
  };
  const identifierTag: Record<IdentifierKind, TagType> = {
    with: 'red',
    without: 'gray',
    research: 'purple',
  };

  const period = (detail: DownloadLogDetail) =>
    detail.startDate || detail.endDate
      ? t('downloadPeriod', '{{from}} to {{to}}', { from: detail.startDate ?? '...', to: detail.endDate ?? '...' })
      : t('allDates', 'All dates');

  const targetName = (entry: DownloadLogEntry) => entry.list?.name ?? entry.form?.name ?? '';

  const summary = (entry: DownloadLogEntry) => {
    if (!entry.detail) {
      return '';
    }
    if (entry.list) {
      return t('listColumns', '{{list}}, {{count}} columns', {
        list: entry.list.name,
        count: entry.detail.fields.length,
      });
    }
    return t('fieldsAndPeriod', '{{count}} fields, {{period}}', {
      count: entry.detail.fields.length,
      period: period(entry.detail),
    });
  };

  const stats = {
    downloads: all.length,
    withIdentifiers: all.filter((entry) => entry.detail?.identifiers).length,
    users: new Set(all.map((entry) => entry.user.username)).size,
    rows: all.reduce((sum, entry) => sum + (entry.detail?.rows ?? 0), 0),
  };

  const rows = all.slice(paging.startIndex, paging.startIndex + paging.limit).map((entry, index) => ({
    key: `${entry.date}-${paging.startIndex + index}`,
    time: <span title={fullTime(entry.date)}>{logTime(entry.date)}</span>,
    user: <LogUserCell user={entry.user} />,
    action: <LogActionCell text={t('downloaded', 'Downloaded')} summary={summary(entry)} />,
    target: targetName(entry),
    cells: [
      entry.detail?.rows ?? '',
      entry.detail ? (
        <Tag size="sm" type={identifierTag[identifierKind(entry.detail)]}>
          {identifierLabels[identifierKind(entry.detail)]}
        </Tag>
      ) : (
        ''
      ),
    ],
    detail: entry.detail ? (
      <>
        <div>
          <p className={styles.detailHeading}>{t('fieldsInTheFile', 'Fields in the file')}</p>
          <div className={styles.tags} data-testid="fields-in-file">
            {entry.detail.fields.map((field) => (
              <Tag key={field} size="sm" type="outline">
                {field}
              </Tag>
            ))}
          </div>
          <p className={styles.detailHeading}>{t('fieldsLeftOut', 'Fields the user chose and the file left out')}</p>
          <div className={styles.tags} data-testid="fields-left-out">
            {entry.detail.withheld.length ? (
              entry.detail.withheld.map((field) => (
                <Tag key={field} size="sm" type="outline">
                  {field}
                </Tag>
              ))
            ) : (
              <span className={styles.muted}>{t('none', 'None')}</span>
            )}
          </div>
          {entry.detail.identifiers && (
            <>
              <p className={styles.detailHeading}>{t('whyIdentifiers', 'Why identifiers were included')}</p>
              <p data-testid="why-identifiers">
                {t(
                  'identifiersPrivilegeHeld',
                  'The user holds {{privilege}}, so the file keeps names, birth dates, ID numbers and phones.',
                  {
                    privilege: PRIVILEGE_DOWNLOAD_IDENTIFIERS,
                  },
                )}
              </p>
            </>
          )}
        </div>
        <div>
          <DetailLine label={t('recorded', 'Recorded')}>{fullTime(entry.date)}</DetailLine>
          <DetailLine label={t('rows', 'Rows')}>{entry.detail.rows}</DetailLine>
          {!entry.list && <DetailLine label={t('period', 'Period')}>{period(entry.detail)}</DetailLine>}
          <DetailLine label={t('patients', 'Patients')}>
            {entry.detail.researchOnly
              ? t('researchParticipantsOnly', 'Only those who opted in to research')
              : t('everyPatient', 'Every patient on the registry')}
          </DetailLine>
        </div>
      </>
    ) : (
      <p className={styles.muted}>{t('noDownloadDetail', 'No detail was recorded')}</p>
    ),
  }));

  const headers = [
    t('time', 'Time'),
    t('user', 'User'),
    t('target', 'Target'),
    t('fields', 'Fields'),
    t('period', 'Period'),
    t('rows', 'Rows'),
    t('identifiers', 'Identifiers'),
  ];
  const csvRows = () =>
    all.map((entry) => [
      fullTime(entry.date),
      entry.user.username ?? '',
      targetName(entry),
      entry.detail?.fields.join('; ') ?? '',
      entry.detail && !entry.list ? period(entry.detail) : '',
      String(entry.detail?.rows ?? ''),
      entry.detail ? identifierLabels[identifierKind(entry.detail)] : '',
    ]);

  return (
    <div className={styles.tab}>
      <LogFilterBar
        filters={filters}
        onChange={onFilters}
        actions={
          <DownloadCsvButton
            name="logs-downloads"
            list="logs:downloads"
            identifiers={false}
            filters={setFilters(filters, downloadsFilterKeys)}
            headers={headers}
            rows={csvRows}
            disabled={!all.length}
            size="md"
          />
        }
      >
        <Select
          id="logs-download-form"
          labelText={t('form', 'Form')}
          value={filters.form}
          onChange={(event) => onFilters({ form: event.target.value })}
        >
          <SelectItem value="" text={t('anyForm', 'Any form')} />
          {forms.map((form) => (
            <SelectItem key={form.uuid} value={form.uuid} text={form.name} />
          ))}
        </Select>
        <Select
          id="logs-identifiers"
          labelText={t('identifiers', 'Identifiers')}
          value={filters.identifiers}
          onChange={(event) => onFilters({ identifiers: event.target.value })}
        >
          <SelectItem value="" text={t('any', 'Any')} />
          {identifierKinds.map((kind) => (
            <SelectItem key={kind} value={kind} text={identifierLabels[kind]} />
          ))}
        </Select>
      </LogFilterBar>
      <LogWindowNote from={page?.from} filters={filters} />
      {all.length > 0 && (
        <div className={styles.summaryLine} data-testid="downloads-summary">
          <div className={styles.stat}>
            <strong>{stats.downloads.toLocaleString()}</strong>
            <span>
              {filters.from
                ? t('downloadsSince', 'downloads since {{date}}', { date: date(filters.from) })
                : t('downloadsLower', 'downloads')}
            </span>
          </div>
          <div className={styles.stat}>
            <strong>{stats.withIdentifiers.toLocaleString()}</strong>
            <span>{t('withIdentifiersLower', 'with identifiers')}</span>
          </div>
          <div className={styles.stat}>
            <strong>{stats.users.toLocaleString()}</strong>
            <span>{t('usersLower', 'users')}</span>
          </div>
          <div className={styles.stat}>
            <strong>{stats.rows.toLocaleString()}</strong>
            <span>{t('rowsInTotal', 'rows in total')}</span>
          </div>
        </div>
      )}
      <LogTable
        label={t('downloads', 'Downloads')}
        columns={[t('rows', 'Rows'), t('identifiers', 'Identifiers')]}
        rows={rows}
        totalCount={all.length}
        paging={paging}
        onPage={setPaging}
        isLoading={isLoading}
        error={error}
        filtered={downloadsFilterKeys.some((key) => filters[key])}
        emptyMessage={t('noDownloads', 'There are no downloads to display')}
      />
      <p className={styles.explanation}>
        {t(
          'downloadsExplanation',
          'Every CSV that leaves ACT is here: Download data, the registry and worklist lists, and these logs. A download is recorded before its first row is sent; if it cannot be recorded, it does not happen.',
        )}
      </p>
    </div>
  );
}
