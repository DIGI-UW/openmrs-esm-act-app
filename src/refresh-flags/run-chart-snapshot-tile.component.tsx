import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  InlineLoading,
  InlineNotification,
  SkeletonText,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tile,
} from '@carbon/react';
import { formatDate, formatDatetime, showSnackbar } from '@openmrs/esm-framework';
import { type Night, nightsOf } from './run-chart-nights';
import { type RunChartRun, takeRunChartSnapshot, useRunChartRuns } from './run-chart-snapshot.resource';
import styles from './refresh-flags.scss';

const seconds = (millis: number) => Math.max(1, Math.round(millis / 1000));

/** Admin's run chart snapshot: when it was last taken, Take snapshot now, and how the last seven nights went. */
export function RunChartSnapshotTile() {
  const { t } = useTranslation();
  const { runs, error, isLoading, mutate } = useRunChartRuns();
  const [taking, setTaking] = useState(false);
  const busy = taking || Boolean(runs?.running);

  const take = async () => {
    setTaking(true);
    try {
      const answer = await takeRunChartSnapshot();
      showSnackbar(
        answer.snapshotTaken
          ? {
              kind: 'success',
              title: t('runChartSnapshotTaken', "Today's run chart snapshot taken"),
              subtitle: t('runChartSnapshotTakenRows', '{{rows}} rows ({{clinics}} clinics and all clinics)', {
                rows: answer.rows,
                clinics: answer.clinics,
              }),
            }
          : {
              kind: 'info',
              title: t('snapshotAlreadyRunning', 'A snapshot is already running'),
              subtitle: t('refreshAlreadyRunningDetail', 'Its results show here when it finishes.'),
            },
      );
    } catch (e) {
      showSnackbar({
        kind: 'error',
        title: t('couldNotTakeSnapshot', 'Could not take the run chart snapshot'),
        subtitle: e?.message,
      });
    } finally {
      await mutate();
      setTaking(false);
    }
  };

  const result = (run: RunChartRun | null) => {
    if (!run) {
      return (
        <span className={styles.bad}>
          {t('runChartNightNotRun', 'Not run: nothing was recorded, so the night is missing from the run charts')}
        </span>
      );
    }
    if (run.status === 'failed') {
      return (
        <span className={styles.bad}>
          {t('runChartNightFailed', 'Failed: the snapshot could not be taken')}
          {run.reason && <span className={styles.reason}>{run.reason}</span>}
        </span>
      );
    }
    return (
      <span className={styles.ok}>
        {run.source === 'manual' ? t('runChartNightTakenNow', 'Taken now') : t('runChartNightTaken', 'Taken')}
      </span>
    );
  };

  const nights = (all: Array<RunChartRun>): Array<Night> => nightsOf(all);

  const body = () => {
    if (isLoading) {
      return <SkeletonText width="12rem" />;
    }
    if (error || !runs) {
      return (
        <InlineNotification
          kind="error"
          statusIconDescription={t('errorIcon', 'error icon')}
          lowContrast
          hideCloseButton
          title={t('couldNotLoadSnapshots', 'Could not load the run chart snapshots')}
          subtitle={error?.message}
        />
      );
    }
    return (
      <>
        <p className={styles.lastRefreshed}>
          {runs.lastTaken
            ? t('runChartLastTaken', 'Last taken {{when}}, for {{count}} clinics', {
                when: formatDatetime(new Date(runs.lastTaken.finished)),
                count: runs.lastTaken.clinics,
              })
            : t('runChartNotTakenYet', 'Not taken yet')}
        </p>
        {runs.running && <p>{t('snapshotAlreadyRunning', 'A snapshot is already running')}</p>}
        <Button kind="tertiary" size="md" disabled={busy} onClick={take}>
          {taking ? (
            <InlineLoading description={t('takingSnapshot', 'Taking the snapshot')} />
          ) : (
            t('takeSnapshotNow', 'Take snapshot now')
          )}
        </Button>
        <h3 className={styles.subheading}>{t('lastSevenNights', 'Last 7 nights')}</h3>
        <div className={styles.tableContainer}>
          <Table size="sm" aria-label={t('lastSevenNights', 'Last 7 nights')}>
            <TableHead>
              <TableRow>
                <TableHeader>{t('night', 'Night')}</TableHeader>
                <TableHeader>{t('rows', 'Rows')}</TableHeader>
                <TableHeader>{t('took', 'Took')}</TableHeader>
                <TableHeader>{t('result', 'Result')}</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {nights(runs.runs).map(({ date, run }) => (
                <TableRow key={date} data-testid="run-chart-night">
                  <TableCell>{formatDate(new Date(`${date}T00:00:00`), { time: false, noToday: true })}</TableCell>
                  <TableCell>{run && run.status === 'taken' ? run.rows : run ? '0' : '–'}</TableCell>
                  <TableCell>
                    {run ? t('secondsTook', '{{count}} s', { count: seconds(run.durationMillis) }) : '–'}
                  </TableCell>
                  <TableCell>{result(run)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </>
    );
  };

  return (
    <Tile className={styles.tile} data-testid="run-chart-snapshot">
      <h2 className={styles.heading}>{t('runChartSnapshot', 'Run chart snapshot')}</h2>
      <p className={styles.explanation}>
        {t(
          'runChartSnapshotExplanation',
          "The Dashboard's run charts keep each clinic's figures once a night. Take today's now to see a change on the run charts before tonight. Taking it again today replaces today's rows.",
        )}
      </p>
      {body()}
    </Tile>
  );
}
