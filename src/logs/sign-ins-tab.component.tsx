import React, { useMemo } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { Tag } from '@carbon/react';
import { ConfigurableLink, useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { DownloadCsvButton } from '../table-filters/download-csv-button.component';
import { LogFilterBar, type LogFilters, setFilters, sharedQuery, useLogPaging } from './log-filters.component';
import { DetailLine, LogActionCell, LogTable, LogUserCell, type TagType } from './log-table.component';
import { describeBrowser, describeClient, describeSignInDetails, fullTime, logTime } from './log-time';
import {
  fetchAllLogs,
  type SignInEntry,
  type SignInEventType,
  signInsPage,
  signInsUrl,
  useSignIns,
} from './logs.resource';
import styles from './logs.scss';

const signInsFilterKeys = ['user', 'from', 'to'] as const;

const eventTags: Record<SignInEventType, TagType> = {
  LOGIN_SUCCESS: 'green',
  LOGIN_FAILURE: 'red',
  ACCOUNT_LOCKED: 'red',
  LOGOUT: 'gray',
  SESSION_TIMEOUT: 'gray',
  PASSWORD_RESET_REQUEST_SUCCESS: 'gray',
  PASSWORD_RESET_REQUEST_FAILURE: 'red',
  PASSWORD_RESET_SUCCESS: 'gray',
  PASSWORD_RESET_FAILURE: 'red',
  PASSWORD_CHANGED_SUCCESS: 'gray',
  PASSWORD_CHANGED_FAILURE: 'red',
  UNKNOWN: 'gray',
};

/** What the audit module's security events are called in the tab. */
export function useSignInLabels(): Record<SignInEventType, string> {
  const { t } = useTranslation();
  return {
    LOGIN_SUCCESS: t('signedIn', 'Signed in'),
    LOGIN_FAILURE: t('signInFailed', 'Sign-in failed'),
    ACCOUNT_LOCKED: t('accountLocked', 'Account locked'),
    LOGOUT: t('signedOut', 'Signed out'),
    SESSION_TIMEOUT: t('sessionTimedOut', 'Session timed out'),
    PASSWORD_RESET_REQUEST_SUCCESS: t('passwordResetRequested', 'Password reset requested'),
    PASSWORD_RESET_REQUEST_FAILURE: t('passwordResetRequestFailed', 'Password reset request failed'),
    PASSWORD_RESET_SUCCESS: t('passwordWasReset', 'Password reset'),
    PASSWORD_RESET_FAILURE: t('passwordResetFailed', 'Password reset failed'),
    PASSWORD_CHANGED_SUCCESS: t('passwordChanged', 'Password changed'),
    PASSWORD_CHANGED_FAILURE: t('passwordChangeFailed', 'Password change failed'),
    UNKNOWN: t('otherSecurityEvent', 'Other'),
  };
}

/** Sign-ins, failed attempts, sign-outs and password changes, from the audit module's security log. */
export function SignInsTab({
  filters,
  onFilters,
}: {
  filters: LogFilters;
  onFilters: (change: Partial<LogFilters>) => void;
}) {
  const { t } = useTranslation();
  const { adminLinks } = useConfig<Config>();
  const labels = useSignInLabels();
  const query = useMemo(() => sharedQuery(filters), [filters]);
  const [paging, setPaging] = useLogPaging(JSON.stringify(query));
  const { page, error, isLoading } = useSignIns(query, paging);
  const weekAgo = useMemo(() => dayjs().subtract(7, 'day').format('YYYY-MM-DD'), []);
  // Counted for the user the table is filtered to, when it is, so the line reads as the table does.
  const failures = useSignIns(
    { username: query.username, eventType: 'LOGIN_FAILURE', startDate: weekAgo },
    { startIndex: 0, limit: 1 },
  );

  const rows = (page?.results ?? []).map((entry) => ({
    key: String(entry.id),
    time: <span title={fullTime(entry.eventTime)}>{logTime(entry.eventTime)}</span>,
    user: <LogUserCell user={{ uuid: entry.userUUID, username: entry.username }} />,
    action: (
      <LogActionCell
        tag={
          <Tag size="sm" type={eventTags[entry.eventType] ?? 'gray'}>
            {labels[entry.eventType] ?? entry.eventType}
          </Tag>
        }
        summary={[describeSignInDetails(entry.details), describeBrowser(entry.userAgent)].filter(Boolean).join(', ')}
      />
    ),
    target: entry.ipAddress ?? '',
    detail: (
      <>
        <div>
          {entry.details && (
            <DetailLine label={t('details', 'Details')}>{describeSignInDetails(entry.details)}</DetailLine>
          )}
          <DetailLine label={labels[entry.eventType] ?? entry.eventType}>{fullTime(entry.eventTime)}</DetailLine>
        </div>
        <div>
          {entry.sessionId && <DetailLine label={t('session', 'Session')}>{entry.sessionId}</DetailLine>}
          {(entry.ipAddress || entry.userAgent) && (
            <DetailLine label={t('from', 'From')}>{describeClient(entry.ipAddress, entry.userAgent)}</DetailLine>
          )}
          <p className={styles.detailLine}>
            <ConfigurableLink to={adminLinks.securityAuditUrl}>
              {t('securityRecordInAuditModule', 'The full security record in the audit module')}
            </ConfigurableLink>
          </p>
        </div>
      </>
    ),
  }));

  const headers = [
    t('time', 'Time'),
    t('user', 'User'),
    t('event', 'Event'),
    t('details', 'Details'),
    t('ipAddress', 'IP address'),
  ];
  const csvRows = async () =>
    (await fetchAllLogs<SignInEntry>((p) => signInsUrl(query, p), signInsPage)).results.map((entry) => [
      fullTime(entry.eventTime),
      entry.username ?? '',
      labels[entry.eventType] ?? entry.eventType,
      describeSignInDetails(entry.details),
      entry.ipAddress ?? '',
    ]);

  return (
    <div className={styles.tab}>
      <LogFilterBar
        filters={filters}
        onChange={onFilters}
        actions={
          <DownloadCsvButton
            name="logs-sign-ins"
            list="logs:signIns"
            identifiers={false}
            filters={setFilters(filters, signInsFilterKeys)}
            headers={headers}
            rows={csvRows}
            disabled={!page?.results.length}
            size="md"
          />
        }
      />
      <LogTable
        label={t('signIns', 'Sign-ins')}
        rows={rows}
        totalCount={page?.totalCount ?? 0}
        paging={paging}
        onPage={setPaging}
        isLoading={isLoading}
        error={error}
        filtered={signInsFilterKeys.some((key) => filters[key])}
        emptyMessage={t('noSignIns', 'There are no sign-ins to display')}
      />
      <p className={styles.explanation}>
        {failures.page && (
          <span data-testid="failed-sign-ins">
            {query.username
              ? t('failedSignInsLastWeekByUser', 'Failed sign-ins by {{user}} in the last 7 days: {{count}}', {
                  user: query.username,
                  count: failures.page.totalCount,
                })
              : t('failedSignInsLastWeek', 'Failed sign-ins in the last 7 days: {{count}}', {
                  count: failures.page.totalCount,
                })}
            {'. '}
          </span>
        )}
        {t(
          'signInsExplanation',
          "Sign-ins, sign-outs, failed attempts and password changes, from the audit module's security log. Locked accounts and the full security record stay in the audit module.",
        )}{' '}
        <ConfigurableLink to={adminLinks.securityAuditUrl}>
          {t('openAuditModule', 'Open the audit module')}
        </ConfigurableLink>
      </p>
    </div>
  );
}
