import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Select, SelectItem, Tag } from '@carbon/react';
import { PRIVILEGE_DOWNLOAD_IDENTIFIERS } from '../constants';
import {
  type DownloadLogDetail,
  type DownloadLogEntry,
  patientFieldLabels,
  useDownloadForms,
} from '../download/download.resource';
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
import { fullTime, logDay, logTime } from './log-time';
import { useAllDownloads } from './logs.resource';
import { type Figure, FigureTiles } from '../figure-tiles/figure-tiles.component';
import styles from './logs.scss';

const downloadsFilterKeys = ['user', 'from', 'to', 'form', 'identifiers'] as const;

const identifierKinds = ['with', 'without', 'research'] as const;

type IdentifierKind = (typeof identifierKinds)[number];

const identifierKind = (entry: DownloadLogEntry): IdentifierKind =>
  entry.identifiers ?? (entry.detail?.researchOnly ? 'research' : entry.detail?.identifiers ? 'with' : 'without');

const texts = (value: unknown) => Array.isArray(value) && value.every((item) => typeof item === 'string');

const textOrAbsent = (value: unknown) => value == null || typeof value === 'string';

/** Whether the detail has the shape the tab renders; one from an older, newer or edited row may not. */
const readable = (detail: DownloadLogDetail) =>
  texts(detail.fields) &&
  texts(detail.withheld) &&
  typeof detail.rows === 'number' &&
  (detail.patient == null || texts(detail.patient)) &&
  (detail.forms == null ||
    (Array.isArray(detail.forms) && detail.forms.every((form) => typeof form?.name === 'string'))) &&
  ['status', 'cardiacClinic', 'primaryCareClinic'].every((key) => textOrAbsent(detail.filters?.[key]));

const asListed = (entry: DownloadLogEntry): DownloadLogEntry =>
  entry.detail && !readable(entry.detail) ? { ...entry, detail: null, unreadable: true } : entry;

const tagged = (entry: DownloadLogEntry) => Boolean(entry.detail || (entry.unreadable && entry.identifiers));

const narrowed = (detail: DownloadLogDetail) =>
  Boolean(detail.filters?.status || detail.filters?.cardiacClinic || detail.filters?.primaryCareClinic);

/**
 * Every CSV that left ACT: Download data's forms, the registry and worklist lists and these logs, from ACT Core's
 * download log, with summary figures over every matching download.
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
  const all = useMemo(() => (page?.results ?? []).map(asListed), [page]);

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

  const patientLabels = patientFieldLabels(t);

  const statusLabels: Record<string, string> = {
    active: t('active', 'Active'),
    inactive: t('inactive', 'Inactive'),
  };

  const period = (detail: DownloadLogDetail) =>
    detail.startDate || detail.endDate
      ? t('downloadPeriod', '{{from}} to {{to}}', { from: detail.startDate ?? '...', to: detail.endDate ?? '...' })
      : t('allDates', 'All dates');

  const targetName = (entry: DownloadLogEntry) =>
    entry.list?.name ?? entry.form?.name ?? (entry.detail?.forms ?? []).map((form) => form.name).join(', ');

  const summary = (entry: DownloadLogEntry) => {
    if (entry.unreadable) {
      return t('downloadDetailUnreadable', 'Detail could not be read');
    }
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
    withIdentifiers: all.filter((entry) => identifierKind(entry) === 'with').length,
    users: new Set(all.map((entry) => entry.user.username)).size,
    rows: all.reduce((sum, entry) => sum + (entry.detail?.rows ?? 0), 0),
  };

  // Use the period the server returned, so a pending or refused filter cannot mislabel the counts.
  let periodCaption: string | undefined;
  if (page?.from && page.to) {
    periodCaption = t('downloadPeriod', '{{from}} to {{to}}', { from: logDay(page.from), to: logDay(page.to) });
  } else if (page?.from) {
    periodCaption = t('sinceDate', 'since {{date}}', { date: logDay(page.from) });
  }
  const figures: Array<Figure> = [
    {
      key: 'downloads',
      label: t('downloads', 'Downloads'),
      value: stats.downloads.toLocaleString(),
      caption: periodCaption,
    },
    {
      key: 'identifiers',
      label: t('withIdentifiers', 'With identifiers'),
      value: stats.withIdentifiers.toLocaleString(),
      tone: stats.withIdentifiers > 0 ? 'alert' : undefined,
    },
    { key: 'users', label: t('users', 'Users'), value: stats.users.toLocaleString() },
    { key: 'rows', label: t('rowsDownloaded', 'Rows downloaded'), value: stats.rows.toLocaleString() },
  ];

  const rows = all.slice(paging.startIndex, paging.startIndex + paging.limit).map((entry, index) => ({
    key: `${entry.date}-${paging.startIndex + index}`,
    time: <span title={fullTime(entry.date)}>{logTime(t, entry.date)}</span>,
    user: <LogUserCell user={entry.user} />,
    action: <LogActionCell text={t('downloaded', 'Downloaded')} summary={summary(entry)} />,
    target: targetName(entry),
    cells: [
      entry.detail?.rows ?? '',
      tagged(entry) ? (
        <Tag size="sm" type={identifierTag[identifierKind(entry)]}>
          {identifierLabels[identifierKind(entry)]}
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
                  'identifyingFieldsKept',
                  'The user holds {{privilege}}, so the file keeps fields that identify the patient.',
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
              : !entry.list && narrowed(entry.detail)
                ? t('patientsTheFiltersKept', 'Only those the filters kept')
                : t('everyPatient', 'Every patient on the registry')}
          </DetailLine>
          {!entry.list && (
            <>
              {entry.detail.filters?.status && (
                <DetailLine label={t('status', 'Status')}>
                  {statusLabels[entry.detail.filters.status] ?? entry.detail.filters.status}
                </DetailLine>
              )}
              {entry.detail.filters?.cardiacClinic && (
                <DetailLine label={t('cardiacClinic', 'Cardiac clinic')}>
                  {entry.detail.filters.cardiacClinic}
                </DetailLine>
              )}
              {entry.detail.filters?.primaryCareClinic && (
                <DetailLine label={t('primaryCareClinic', 'Primary care clinic')}>
                  {entry.detail.filters.primaryCareClinic}
                </DetailLine>
              )}
              {entry.detail.patient && (
                <DetailLine label={t('patientFields', 'Patient fields')}>
                  {[t('actId', 'ACT ID'), ...entry.detail.patient.map((key) => patientLabels[key] ?? key)].join(', ')}
                </DetailLine>
              )}
              {entry.detail.rowPerPatient !== undefined && (
                <DetailLine label={t('layout', 'Layout')}>
                  {entry.detail.rowPerPatient
                    ? t('rowPerPatient', 'A row per patient')
                    : t('rowPerSavedForm', 'A row per saved form')}
                </DetailLine>
              )}
            </>
          )}
        </div>
      </>
    ) : (
      <p className={styles.muted}>
        {entry.unreadable
          ? t('recordedDownloadDetailUnreadable', 'The recorded detail could not be read')
          : t('noDownloadDetail', 'No detail was recorded')}
      </p>
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
      tagged(entry) ? identifierLabels[identifierKind(entry)] : '',
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
      {all.length > 0 && <FigureTiles figures={figures} columns={4} testId="downloads-figure" />}
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
