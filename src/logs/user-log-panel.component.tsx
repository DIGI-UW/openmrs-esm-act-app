import React, { useMemo } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { Button, InlineLoading, InlineNotification } from '@carbon/react';
import { Close } from '@carbon/react/icons';
import { ConfigurableLink, useConfig, userHasAccess, useSession } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import {
  PRIVILEGE_VIEW_AUDIT_LOGS,
  PRIVILEGE_VIEW_READ_AUDIT_LOGS,
  PRIVILEGE_VIEW_SECURITY_AUDIT_LOGS,
} from '../constants';
import { restErrorMessage } from '../rest-error-message';
import { describeSignInDetails, logTime } from './log-time';
import { type Paging, useActivity, useDownloads, useReads, useSignIns } from './logs.resource';
import { useSignInLabels } from './sign-ins-tab.component';
import styles from './logs.scss';

type Source = 'activity' | 'reads' | 'downloads' | 'signIns';

interface PanelEntry {
  key: string;
  time: string;
  source: Source;
  text: React.ReactNode;
  summary?: string | null;
}

const latest: Paging = { startIndex: 0, limit: 10 };
const countOnly: Paging = { startIndex: 0, limit: 1 };

/** The most entries the panel shows of the four sources merged, as ACT 2.0's dialog showed a user's last 25. */
const MOST_ENTRIES = 25;

/**
 * One user's log, as ACT 2.0's User Logs dialog: their latest entries across the four tabs, newest first, with
 * counts for the last 7 days and a link to Logs filtered to them. Each source shows to a user holding its privilege.
 */
export function UserLogPanel({
  username,
  name,
  subtitle,
  onClose,
}: {
  username: string;
  name: string;
  subtitle?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { user: me } = useSession();
  const { adminLinks } = useConfig<Config>();
  const signInLabels = useSignInLabels();
  const mayChanges = !!me && userHasAccess(PRIVILEGE_VIEW_AUDIT_LOGS, me);
  const mayReads = !!me && userHasAccess(PRIVILEGE_VIEW_READ_AUDIT_LOGS, me);
  const maySignIns = !!me && userHasAccess(PRIVILEGE_VIEW_SECURITY_AUDIT_LOGS, me);
  const weekAgo = useMemo(() => dayjs().subtract(7, 'day').format('YYYY-MM-DD'), []);

  const activity = useActivity({ username }, latest, mayChanges);
  const reads = useReads({ username }, latest, mayReads);
  const downloads = useDownloads({ username }, latest, mayReads);
  const signIns = useSignIns({ username }, latest, maySignIns);
  const savedThisWeek = useActivity({ username, kind: 'saved', startDate: weekAgo }, countOnly, mayChanges);
  const readThisWeek = useReads({ username, startDate: weekAgo }, countOnly, mayReads);
  const downloadedThisWeek = useDownloads({ username, startDate: weekAgo }, countOnly, mayReads);

  const sources = [
    { source: 'activity' as const, ...activity, may: mayChanges },
    { source: 'reads' as const, ...reads, may: mayReads },
    { source: 'downloads' as const, ...downloads, may: mayReads },
    { source: 'signIns' as const, ...signIns, may: maySignIns },
  ].filter((one) => one.may);
  const loading = sources.some((one) => one.isLoading);
  const failed = sources.find((one) => one.error)?.error;

  const entries: Array<PanelEntry> = [
    ...(activity.page?.results ?? []).map((entry, index) => ({
      // A flag dismissal has no revision id, so two of them are told apart by their place in the page.
      key: `activity-${entry.revisionId ?? `row-${index}`}`,
      time: entry.time,
      source: 'activity' as const,
      text: (
        <>
          <strong>{entry.action}</strong>
          {entry.target?.display && (
            <>
              {entry.kind === 'registered'
                ? t('registeredTarget', ', {{target}}', { target: entry.target.display })
                : ` ${t('forTarget', 'for {{target}}', { target: entry.target.display })}`}
              {entry.target.actId && <code className={styles.actId}>{entry.target.actId}</code>}
            </>
          )}
        </>
      ),
      summary: entry.summary,
    })),
    ...(reads.page?.results ?? []).map((entry) => ({
      key: `reads-${entry.id}`,
      time: entry.from,
      source: 'reads' as const,
      text: entry.patient ? (
        <>
          <strong>{t('openedTheChart', 'Opened the chart')}</strong>{' '}
          {t('ofPatient', 'of {{patient}}', { patient: entry.patient.display })}
        </>
      ) : (
        <strong>{entry.reads[0]?.description}</strong>
      ),
      summary: entry.count > 1 ? t('readCount', '{{count}} reads', { count: entry.count }) : null,
    })),
    ...(downloads.page?.results ?? []).map((entry, index) => ({
      key: `downloads-${entry.date}-${index}`,
      time: entry.date,
      source: 'downloads' as const,
      text: (
        <>
          <strong>{t('downloaded', 'Downloaded')}</strong> {entry.list?.name ?? entry.form?.name ?? ''}
        </>
      ),
      summary: entry.detail ? t('rowCount', '{{count}} rows', { count: entry.detail.rows }) : null,
    })),
    ...(signIns.page?.results ?? []).map((entry) => ({
      key: `signIns-${entry.id}`,
      time: entry.eventTime,
      source: 'signIns' as const,
      text: <strong>{signInLabels[entry.eventType] ?? entry.eventType}</strong>,
      summary: describeSignInDetails(t, entry.details),
    })),
  ]
    .sort((a, b) => b.time.localeCompare(a.time))
    .slice(0, MOST_ENTRIES);

  const dotClass: Record<Source, string> = {
    activity: styles.dotActivity,
    reads: styles.dotReads,
    downloads: styles.dotDownloads,
    signIns: styles.dotSignIns,
  };
  const sourceLabels: Record<Source, string> = {
    activity: t('activity', 'Activity'),
    reads: t('opened', 'Opened'),
    downloads: t('downloads', 'Downloads'),
    signIns: t('signIns', 'Sign-ins'),
  };

  return (
    <aside className={styles.panel} aria-label={t('usersLog', "{{name}}'s log", { name })}>
      <div className={styles.panelHeader}>
        <div>
          <h2>{t('usersLog', "{{name}}'s log", { name })}</h2>
          {subtitle && <p className={styles.subline}>{subtitle}</p>}
        </div>
        <Button
          kind="ghost"
          size="sm"
          hasIconOnly
          renderIcon={Close}
          iconDescription={t('close', 'Close')}
          onClick={onClose}
        />
      </div>
      <div className={styles.panelCounts} data-testid="log-counts">
        {mayChanges && (
          <div className={styles.stat}>
            <strong>{savedThisWeek.page?.totalCount ?? '–'}</strong>
            <span>{t('formsSavedLastWeek', 'forms saved, 7 days')}</span>
          </div>
        )}
        {mayReads && (
          <>
            <div className={styles.stat}>
              <strong>{readThisWeek.page?.totalCount ?? '–'}</strong>
              <span>{t('patientsOpenedLower', 'patients opened')}</span>
            </div>
            <div className={styles.stat}>
              <strong>{downloadedThisWeek.page?.totalCount ?? '–'}</strong>
              <span>{t('downloadsLower', 'downloads')}</span>
            </div>
          </>
        )}
      </div>
      {failed && (
        <InlineNotification
          kind="error"
          statusIconDescription={t('errorIcon', 'error icon')}
          lowContrast
          hideCloseButton
          title={t('couldNotLoadLog', 'Could not load the log')}
          subtitle={restErrorMessage(failed)}
        />
      )}
      {loading && !entries.length ? (
        <InlineLoading description={t('loading', 'Loading...')} />
      ) : !entries.length ? (
        !failed && <p className={styles.explanation}>{t('noLogEntries', 'No entries yet')}</p>
      ) : (
        <dl className={styles.panelEntries}>
          {entries.map((entry) => (
            <div key={entry.key}>
              <dt>{logTime(t, entry.time)}</dt>
              <dd>
                <span
                  className={`${styles.dot} ${dotClass[entry.source]}`}
                  role="img"
                  aria-label={sourceLabels[entry.source]}
                />
                {entry.text}
                {entry.summary && <span className={styles.subline}>{entry.summary}</span>}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <div className={styles.panelFooter}>
        <div className={styles.legend}>
          {(Object.keys(sourceLabels) as Array<Source>)
            .filter((source) => sources.some((one) => one.source === source))
            .map((source) => (
              <span key={source}>
                <span className={`${styles.dot} ${dotClass[source]}`} />
                {sourceLabels[source]}
              </span>
            ))}
        </div>
        <ConfigurableLink to={`${adminLinks.logsUrl}?user=${encodeURIComponent(username)}`}>
          {t('everythingInLogs', 'Everything in Logs')}
        </ConfigurableLink>
      </div>
    </aside>
  );
}
