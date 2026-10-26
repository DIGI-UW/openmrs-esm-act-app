import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { InlineLoading, InlineNotification, Select, SelectItem, Tag } from '@carbon/react';
import { ConfigurableLink, useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { useDownloadForms } from '../download/download.resource';
import { patientChartUrl } from '../patient-chart-url';
import { restErrorMessage } from '../rest-error-message';
import { DownloadCsvButton } from '../table-filters/download-csv-button.component';
import {
  LogFilterBar,
  type LogFilters,
  LogWindowNote,
  setFilters,
  sharedQuery,
  useLogPaging,
} from './log-filters.component';
import { DetailLine, LogActionCell, LogTable, LogTargetCell, LogUserCell, type TagType } from './log-table.component';
import { describeClient, fullTime, logTime } from './log-time';
import {
  type ActivityEntry,
  type ActivityKind,
  activityUrl,
  fetchAllLogs,
  type LogPage,
  useActivity,
  useActivityDetail,
} from './logs.resource';
import styles from './logs.scss';

/** Each kind's tag colour, and for the form and patient kinds the verb ACT Core opens the action with. */
const kinds: Record<ActivityKind, { type: TagType; verb?: string }> = {
  saved: { type: 'green', verb: 'Saved' },
  edited: { type: 'blue', verb: 'Edited' },
  voided: { type: 'red', verb: 'Voided' },
  registered: { type: 'green', verb: 'Registered' },
  patientStatus: { type: 'purple' },
  user: { type: 'teal' },
  role: { type: 'cyan' },
  clinic: { type: 'cyan' },
  study: { type: 'magenta' },
  flag: { type: 'warm-gray' },
  other: { type: 'gray' },
};

const activityFilterKeys = ['user', 'from', 'to', 'kind', 'form'] as const;

/** The expanded row: the fields set, or changed from what, with the save's time, visit, source and links. */
function ActivityDetailRow({ entry, label }: { entry: ActivityEntry; label: string }) {
  const { t } = useTranslation();
  const { adminLinks } = useConfig<Config>();
  const { detail, error, isLoading } = useActivityDetail(entry.revisionId);
  let fields: React.ReactNode;
  if (error) {
    fields = (
      <InlineNotification
        kind="error"
        statusIconDescription={t('errorIcon', 'error icon')}
        lowContrast
        hideCloseButton
        title={t('couldNotLoadFields', "Could not load the form's fields")}
        subtitle={restErrorMessage(error)}
      />
    );
  } else if (entry.revisionId === null) {
    fields = <p className={styles.muted}>{entry.summary ?? t('noFieldsChanged', 'No fields recorded')}</p>;
  } else if (isLoading || !detail) {
    fields = <InlineLoading description={t('loading', 'Loading...')} />;
  } else if (!detail.fields.length) {
    fields = <p className={styles.muted}>{t('noFieldsChanged', 'No fields recorded')}</p>;
  } else {
    fields = (
      <dl className={styles.fields}>
        {detail.fields.map((field) => (
          <div key={field.name}>
            <dt>{field.name}</dt>
            <dd>
              {entry.kind === 'edited' && field.previous && <span className={styles.previous}>{field.previous}</span>}
              {field.current ?? <span className={styles.muted}>{t('cleared', 'cleared')}</span>}
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <>
      <div>
        {detail?.voidReason && <DetailLine label={t('reason', 'Reason')}>{detail.voidReason}</DetailLine>}
        {fields}
      </div>
      <div>
        <DetailLine label={label}>{fullTime(entry.time)}</DetailLine>
        {entry.encounter?.form && (
          <DetailLine label={t('form', 'Form')}>
            {entry.encounter.visitDate
              ? t('formOnVisitDate', '{{form}}, visit of {{date}}', {
                  form: entry.encounter.form.name,
                  date: entry.encounter.visitDate,
                })
              : entry.encounter.form.name}
          </DetailLine>
        )}
        {(entry.ip || entry.userAgent) && (
          <DetailLine label={t('from', 'From')}>{describeClient(t, entry.ip, entry.userAgent)}</DetailLine>
        )}
        {entry.target?.kind === 'patient' && entry.target.uuid && (
          <p className={styles.detailLine}>
            <ConfigurableLink to={patientChartUrl(entry.target.uuid)}>
              {t('openPatientsChart', "Open {{name}}'s chart", { name: entry.target.display })}
            </ConfigurableLink>
          </p>
        )}
        <p className={styles.detailLine}>
          <ConfigurableLink to={`${adminLinks.auditLogsUrl}?username=${encodeURIComponent(entry.user.username)}`}>
            {t('revisionInAuditModule', 'This change in the audit module (every field, every revision)')}
          </ConfigurableLink>
        </p>
      </div>
    </>
  );
}

/**
 * What ACT's users changed: one row per save, named by form and patient, from ACT Core's grouping of the audit
 * module's revisions. The server's own setup changes stay in the audit module, linked below.
 */
export function ActivityTab({
  filters,
  onFilters,
}: {
  filters: LogFilters;
  onFilters: (change: Partial<LogFilters>) => void;
}) {
  const { t } = useTranslation();
  const { adminLinks } = useConfig<Config>();
  const { forms } = useDownloadForms();
  const query = useMemo(
    () => ({ ...sharedQuery(filters), kind: filters.kind || undefined, form: filters.form || undefined }),
    [filters],
  );
  const [paging, setPaging] = useLogPaging(JSON.stringify(query));
  const { page, error, isLoading } = useActivity(query, paging);

  const kindLabels: Record<ActivityKind, string> = {
    saved: t('kindSaved', 'Saved'),
    edited: t('kindEdited', 'Edited'),
    voided: t('kindVoided', 'Voided'),
    registered: t('kindRegistered', 'Registered'),
    patientStatus: t('kindPatientStatus', 'Patient status'),
    user: t('kindUser', 'User'),
    role: t('kindRole', 'Role'),
    clinic: t('kindClinic', 'Clinic'),
    study: t('kindStudy', 'Study'),
    flag: t('kindFlag', 'Flag'),
    other: t('kindOther', 'Other'),
  };
  const kindFilterLabels: Record<ActivityKind, string> = {
    ...kindLabels,
    saved: t('savedAForm', 'Saved a form'),
    edited: t('editedAForm', 'Edited a form'),
    voided: t('voidedAForm', 'Voided a form'),
    registered: t('registeredAPatient', 'Registered a patient'),
    user: t('users', 'Users'),
    role: t('roles', 'Roles'),
    clinic: t('clinics', 'Clinics'),
    study: t('studies', 'Studies'),
    flag: t('flags', 'Flags'),
  };

  /** The tag reads the verb for the form and patient kinds, so the action beside it is the object alone. */
  const actionText = (entry: ActivityEntry) => {
    const verb = kinds[entry.kind]?.verb;
    return verb && entry.action.startsWith(`${verb} `) ? entry.action.slice(verb.length + 1) : entry.action;
  };
  const tagText = (entry: ActivityEntry) => kindLabels[entry.kind] ?? entry.kind;

  const rows = (page?.results ?? []).map((entry, index) => ({
    key: entry.revisionId === null ? `row-${paging.startIndex + index}` : String(entry.revisionId),
    time: <span title={fullTime(entry.time)}>{logTime(t, entry.time)}</span>,
    user: <LogUserCell user={entry.user} />,
    action: (
      <LogActionCell
        tag={
          <Tag size="sm" type={kinds[entry.kind]?.type ?? 'gray'}>
            {tagText(entry)}
          </Tag>
        }
        text={actionText(entry)}
        summary={entry.summary}
      />
    ),
    target: entry.target ? <LogTargetCell display={entry.target.display} id={entry.target.actId} /> : '',
    detail: <ActivityDetailRow entry={entry} label={tagText(entry)} />,
  }));

  const headers = [
    t('time', 'Time'),
    t('user', 'User'),
    t('action', 'Action'),
    t('summary', 'Summary'),
    t('target', 'Target'),
  ];
  const csvRows = async () =>
    (
      await fetchAllLogs<ActivityEntry>(
        (p) => activityUrl(query, p),
        (data) => data as LogPage<ActivityEntry>,
      )
    ).results.map((entry) => [
      fullTime(entry.time),
      entry.user.username ?? '',
      entry.action,
      entry.summary ?? '',
      [entry.target?.display, entry.target?.actId].filter(Boolean).join(' '),
    ]);

  return (
    <div className={styles.tab}>
      <LogFilterBar
        filters={filters}
        onChange={onFilters}
        actions={
          <DownloadCsvButton
            name="logs-activity"
            list="logs:activity"
            identifiers
            filters={setFilters(filters, activityFilterKeys)}
            headers={headers}
            rows={csvRows}
            disabled={!page?.results.length}
            size="md"
          />
        }
      >
        <Select
          id="logs-kind"
          labelText={t('action', 'Action')}
          value={filters.kind}
          onChange={(event) => onFilters({ kind: event.target.value })}
        >
          <SelectItem value="" text={t('any', 'Any')} />
          {(Object.keys(kinds) as Array<ActivityKind>)
            .filter((kind) => kind !== 'other')
            .map((kind) => (
              <SelectItem key={kind} value={kind} text={kindFilterLabels[kind]} />
            ))}
        </Select>
        <Select
          id="logs-form"
          labelText={t('form', 'Form')}
          value={filters.form}
          onChange={(event) => onFilters({ form: event.target.value })}
        >
          <SelectItem value="" text={t('any', 'Any')} />
          {forms.map((form) => (
            <SelectItem key={form.uuid} value={form.uuid} text={form.name} />
          ))}
        </Select>
      </LogFilterBar>
      <LogWindowNote from={page?.from} filters={filters} />
      <LogTable
        label={t('activity', 'Activity')}
        rows={rows}
        totalCount={page?.totalCount ?? 0}
        paging={paging}
        onPage={setPaging}
        isLoading={isLoading}
        error={error}
        filtered={activityFilterKeys.some((key) => filters[key])}
        emptyMessage={t('noActivity', 'There is no activity to display')}
      />
      <p className={styles.explanation}>
        {t(
          'activityExplanation',
          "Activity lists what ACT's users change: forms, patients, users, roles, clinics, studies and flags. Changes to the server's own setup (concepts, form definitions, settings) stay in the audit module, for the same privilege.",
        )}{' '}
        <ConfigurableLink to={adminLinks.auditLogsUrl}>
          {t('openAuditModule', 'Open the audit module')}
        </ConfigurableLink>
      </p>
    </div>
  );
}
