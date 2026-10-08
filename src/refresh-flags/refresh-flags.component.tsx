import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, InlineLoading, InlineNotification, SkeletonText, Tile } from '@carbon/react';
import { formatDatetime, PatientListsPictogram, showSnackbar } from '@openmrs/esm-framework';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import { SessionLocationAndDate } from '../act-page-header/session-location-and-date.component';
import { runRefresh, useRefreshStatus } from './refresh-flags.resource';
import styles from './refresh-flags.scss';

/** Admin's Flags and adherence page: when ACT Core last refreshed them, and Refresh now. */
export default function RefreshFlags() {
  const { t } = useTranslation();
  const { status, error, isLoading, mutate } = useRefreshStatus();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const result = await runRefresh();
      await mutate(result, { revalidate: false });
      showSnackbar(
        result.refreshed
          ? { kind: 'success', title: t('flagsRefreshed', 'Flags and adherence refreshed') }
          : {
              kind: 'info',
              title: t('refreshAlreadyRunning', 'A refresh is already running'),
              subtitle: t('refreshAlreadyRunningDetail', 'Its results show here when it finishes.'),
            },
      );
    } catch (e) {
      showSnackbar({
        kind: 'error',
        title: t('couldNotRefresh', 'Could not refresh flags and adherence'),
        subtitle: e?.message,
      });
    } finally {
      setRefreshing(false);
    }
  };

  const lastRefreshed = () => {
    if (isLoading) {
      return <SkeletonText width="12rem" />;
    }
    if (error) {
      return (
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title={t('couldNotLoadLastRefresh', 'Could not load when they were last refreshed')}
          subtitle={error.message}
        />
      );
    }
    return (
      <>
        <p className={styles.lastRefreshed}>
          {status?.lastRefreshed
            ? t('lastRefreshedAt', 'Last refreshed {{when}}', { when: formatDatetime(new Date(status.lastRefreshed)) })
            : t('notRefreshedYet', 'Not refreshed yet')}
        </p>
        {status?.running && <p>{t('refreshAlreadyRunning', 'A refresh is already running')}</p>}
      </>
    );
  };

  return (
    <>
      <ActPageHeader
        title={t('flagsAndAdherence', 'Flags and adherence')}
        illustration={<PatientListsPictogram />}
        actions={<SessionLocationAndDate />}
      />
      <div className={styles.page}>
        <Tile className={styles.tile}>
          <p className={styles.explanation}>
            {t(
              'refreshExplanation',
              "Critical data flags, the worklists and every patient's prophylaxis adherence are recalculated once a day. Refresh them now to see today's changes.",
            )}
          </p>
          {lastRefreshed()}
          <Button kind="primary" size="md" disabled={refreshing || status?.running} onClick={refresh}>
            {refreshing ? (
              <InlineLoading description={t('refreshing', 'Refreshing')} />
            ) : (
              t('refreshNow', 'Refresh now')
            )}
          </Button>
        </Tile>
      </div>
    </>
  );
}
