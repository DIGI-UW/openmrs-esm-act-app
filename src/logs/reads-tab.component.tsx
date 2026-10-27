import React, { useMemo } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { TextInput } from '@carbon/react';
import { ConfigurableLink, useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { DownloadCsvButton } from '../table-filters/download-csv-button.component';
import {
  LogFilterBar,
  type LogFilters,
  LogWindowNote,
  setFilters,
  sharedQuery,
  useLogPaging,
} from './log-filters.component';
import { DetailLine, LogActionCell, LogTable, LogTargetCell, LogUserCell } from './log-table.component';
import { describeClient, fullTime, logTimeRange } from './log-time';
import { fetchAllLogs, type LogPage, type ReadEntry, readsUrl, useReads } from './logs.resource';
import styles from './logs.scss';

const readsFilterKeys = ['user', 'from', 'to', 'patient'] as const;

/** The clinic a patient is at for the comparison with the user's: the primary care clinic, else the cardiac one. */
const patientClinic = (entry: ReadEntry) => entry.patient?.primaryCareClinic ?? entry.patient?.cardiacClinic;

/**
 * What ACT's users read: a user's reads of one patient within an hour as one row, named with the patient's name and
 * ACT ID, and a note when the patient is at another clinic than the user's.
 */
export function ReadsTab({
  filters,
  onFilters,
}: {
  filters: LogFilters;
  onFilters: (change: Partial<LogFilters>) => void;
}) {
  const { t } = useTranslation();
  const { adminLinks } = useConfig<Config>();
  const query = useMemo(() => ({ ...sharedQuery(filters), patient: filters.patient.trim() || undefined }), [filters]);
  const [paging, setPaging] = useLogPaging(JSON.stringify(query));
  const { page, error, isLoading } = useReads(query, paging);

  const summary = (entry: ReadEntry) => {
    const parts: Array<string> = [];
    if (entry.count > 1) {
      const minutes = Math.round(dayjs(entry.to).diff(entry.from, 'second') / 60);
      parts.push(
        minutes > 1
          ? t('readTimesInMinutes', '{{count}} times in {{minutes}} minutes', { count: entry.count, minutes })
          : t('readTimesWithinAMinute', '{{count}} times within a minute', { count: entry.count }),
      );
    } else if (entry.patient) {
      parts.push(entry.reads[0]?.description ?? '');
    }
    if (entry.sameClinicAsUser === false) {
      parts.push(
        t('patientAtOtherClinic', "the patient is at {{clinic}}, not the user's clinic", {
          clinic: patientClinic(entry),
        }),
      );
    }
    return parts.filter(Boolean).join('; ');
  };

  const rows = (page?.results ?? []).map((entry) => ({
    key: entry.id,
    time: <span title={fullTime(entry.from)}>{logTimeRange(t, entry.from, entry.to)}</span>,
    user: <LogUserCell user={entry.user} />,
    action: (
      <LogActionCell
        text={entry.patient ? t('openedTheChart', 'Opened the chart') : entry.reads[0]?.description}
        summary={entry.patient ? summary(entry) : entry.reads.length > 1 ? summary(entry) : undefined}
      />
    ),
    target: entry.patient ? (
      <LogTargetCell display={entry.patient.display} id={entry.patient.actId} />
    ) : (
      entry.reads[0]?.entity
    ),
    detail: (
      <>
        <div>
          <p className={styles.detailHeading}>{t('whatWasRead', 'What was read')}</p>
          <dl className={styles.reads}>
            {entry.reads.map((read, index) => (
              <div key={`${read.time}-${index}`}>
                <dt>{dayjs(read.time).format('HH:mm:ss')}</dt>
                <dd>{read.description}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          {entry.sessionId && <DetailLine label={t('session', 'Session')}>{entry.sessionId}</DetailLine>}
          {(entry.ip || entry.userAgent) && (
            <DetailLine label={t('from', 'From')}>{describeClient(t, entry.ip, entry.userAgent)}</DetailLine>
          )}
          {entry.patient && entry.sameClinicAsUser !== null && (
            <DetailLine label={t('patientsClinic', "Patient's clinic")}>
              {entry.sameClinicAsUser
                ? t('sameClinicAsUser', "{{clinic}}, the same as the user's: expected", {
                    clinic: patientClinic(entry),
                  })
                : t('notUsersClinic', "{{clinic}}, not the user's", { clinic: patientClinic(entry) })}
            </DetailLine>
          )}
          <p className={styles.detailLine}>
            <ConfigurableLink to={adminLinks.readAuditUrl}>
              {t('everyReadInAuditModule', 'Every read in the audit module')}
            </ConfigurableLink>
          </p>
        </div>
      </>
    ),
  }));

  const headers = [
    t('from', 'From'),
    t('to', 'To'),
    t('user', 'User'),
    t('action', 'Action'),
    t('target', 'Target'),
    t('reads', 'Reads'),
  ];
  const csvRows = async () =>
    (
      await fetchAllLogs<ReadEntry>(
        (p) => readsUrl(query, p),
        (data) => data as LogPage<ReadEntry>,
      )
    ).results.map((entry) => [
      fullTime(entry.from),
      fullTime(entry.to),
      entry.user.username ?? '',
      entry.patient ? t('openedTheChart', 'Opened the chart') : (entry.reads[0]?.description ?? ''),
      entry.patient
        ? [entry.patient.display, entry.patient.actId].filter(Boolean).join(' ')
        : (entry.reads[0]?.entity ?? ''),
      String(entry.count),
    ]);

  return (
    <div className={styles.tab}>
      <LogFilterBar
        filters={filters}
        onChange={onFilters}
        actions={
          <DownloadCsvButton
            name="logs-patients-opened"
            list="logs:reads"
            identifiers
            filters={setFilters(filters, readsFilterKeys)}
            headers={headers}
            rows={csvRows}
            disabled={!page?.results.length}
            size="md"
          />
        }
      >
        <TextInput
          id="logs-patient"
          labelText={t('patient', 'Patient')}
          placeholder={t('nameOrActId', 'Name or ACT ID')}
          value={filters.patient}
          onChange={(event) => onFilters({ patient: event.target.value })}
        />
      </LogFilterBar>
      <LogWindowNote from={page?.from} filters={filters} />
      <LogTable
        label={t('patientsOpened', 'Patients opened')}
        rows={rows}
        totalCount={page?.totalCount ?? 0}
        paging={paging}
        onPage={setPaging}
        isLoading={isLoading}
        error={error}
        filtered={readsFilterKeys.some((key) => filters[key])}
        emptyMessage={t('noReads', 'There are no reads to display')}
      />
      <p className={styles.explanation}>
        {t(
          'readsExplanation',
          "A user's reads of one patient within an hour are one row; expand it for each one. The row says when the patient is at another clinic than the user's.",
        )}
      </p>
    </div>
  );
}
