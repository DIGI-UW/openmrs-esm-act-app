import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  DataTableSkeleton,
  InlineNotification,
  Modal,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
  TextInput,
} from '@carbon/react';
import { Add, Edit } from '@carbon/react/icons';
import {
  ConfigurableLink,
  formatDate,
  isDesktop,
  CohortsPictogram,
  showSnackbar,
  useConfig,
  useLayoutType,
  UserHasAccess,
} from '@openmrs/esm-framework';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import { type Config } from '../config-schema';
import { PRIVILEGE_MANAGE_STUDIES } from '../constants';
import { patientChartUrl } from '../patient-chart-url';
import { useReportDataset, type ReportRow } from '../reports/report-dataset.resource';
import { parseReportDate } from '../reports/report-date';
import { distinctValues, matchesColumns } from '../table-filters/distinct-values';
import { DownloadCsvButton } from '../table-filters/download-csv-button.component';
import { FilterEmptyState, TableEmptyState } from '../table-filters/empty-state.component';
import { FilterSelect } from '../table-filters/filter-select.component';
import { usePagedRows } from '../table-filters/paged-rows';
import { useUrlFilters } from '../table-filters/url-filters';
import { saveStudy, type Study, useStudies } from './studies.resource';
import styles from './studies.scss';

const filterKeys = ['study', 'status'] as const;
const filterColumns = { study: 'study', status: 'status' };

const reportDate = (value: unknown) => {
  const date = parseReportDate(value);
  return date ? formatDate(date, { time: false, noToday: true }) : '';
};

function StudyNameModal({ study, onClose, onSaved }: { study?: Study; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState(study?.name ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const invalid = submitted && !name.trim();

  const submit = async () => {
    setSubmitted(true);
    if (!name.trim()) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await saveStudy(name.trim(), study?.uuid);
      showSnackbar({ kind: 'success', title: t('studySaved', 'Study saved') });
      onSaved();
      onClose();
    } catch (e) {
      setSaveError(e?.responseBody?.error?.globalErrors?.[0]?.message ?? e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      modalHeading={study ? t('renameStudy', 'Rename study') : t('createStudy', 'Create study')}
      primaryButtonText={saving ? t('saving', 'Saving...') : t('save', 'Save')}
      secondaryButtonText={t('cancel', 'Cancel')}
      primaryButtonDisabled={saving}
      onRequestSubmit={submit}
      onRequestClose={onClose}
      size="sm"
    >
      {saveError && (
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title={t('couldNotSaveStudy', 'Could not save the study')}
          subtitle={saveError}
        />
      )}
      <TextInput
        id="study-name"
        labelText={t('studyName', 'Study name')}
        value={name}
        invalid={invalid}
        invalidText={t('enterAStudyName', 'Enter a name for the study')}
        onChange={(event) => setName(event.target.value)}
      />
    </Modal>
  );
}

function StudiesTable({ rows, onOpen }: { rows: Array<ReportRow>; onOpen: (study: Study) => void }) {
  const { t } = useTranslation();
  const desktop = isDesktop(useLayoutType());
  const { studies, error, isLoading, mutate } = useStudies();
  const [editing, setEditing] = useState<Study | 'new' | null>(null);
  const count = (study: Study, activeOnly: boolean) =>
    rows.filter((row) => row.study_uuid === study.uuid && (!activeOnly || Number(row.active) === 1)).length;

  const table = error ? (
    <InlineNotification
      kind="error"
      lowContrast
      hideCloseButton
      title={t('couldNotLoadStudies', 'Could not load the studies')}
    />
  ) : isLoading ? (
    <DataTableSkeleton
      role="progressbar"
      columnCount={4}
      rowCount={3}
      compact={desktop}
      showHeader={false}
      showToolbar={false}
    />
  ) : !studies.length ? (
    <TableEmptyState message={t('noStudies', 'There are no studies to display')} />
  ) : (
    <Table aria-label={t('studies', 'Studies')} size={desktop ? 'sm' : 'lg'} useZebraStyles>
      <TableHead>
        <TableRow>
          <TableHeader>{t('study', 'Study')}</TableHeader>
          <TableHeader>{t('activeParticipants', 'Active participants')}</TableHeader>
          <TableHeader>{t('allParticipants', 'All participants')}</TableHeader>
          <TableHeader aria-label={t('actions', 'Actions')} />
        </TableRow>
      </TableHead>
      <TableBody>
        {studies.map((study) => (
          <TableRow key={study.uuid}>
            <TableCell>
              <Button kind="ghost" size="sm" onClick={() => onOpen(study)}>
                {study.name}
              </Button>
            </TableCell>
            <TableCell>{count(study, true)}</TableCell>
            <TableCell>{count(study, false)}</TableCell>
            <TableCell>
              <UserHasAccess privilege={PRIVILEGE_MANAGE_STUDIES}>
                <Button
                  kind="ghost"
                  size="sm"
                  hasIconOnly
                  renderIcon={Edit}
                  iconDescription={t('renameStudy', 'Rename study')}
                  onClick={() => setEditing(study)}
                />
              </UserHasAccess>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <section>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>{t('studies', 'Studies')}</h2>
        <UserHasAccess privilege={PRIVILEGE_MANAGE_STUDIES}>
          <Button kind="ghost" size="sm" renderIcon={Add} onClick={() => setEditing('new')}>
            {t('createStudy', 'Create study')}
          </Button>
        </UserHasAccess>
      </div>
      {table}
      {editing && (
        <StudyNameModal
          study={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => mutate()}
        />
      )}
    </section>
  );
}

type Filters = Record<(typeof filterKeys)[number], string>;

function ParticipantsTable({
  rows,
  isLoading,
  error,
  filters,
  setFilters,
}: {
  rows: Array<ReportRow>;
  isLoading: boolean;
  error?: Error;
  filters: Filters;
  setFilters: (change: Partial<Filters>) => void;
}) {
  const { t } = useTranslation();
  const desktop = isDesktop(useLayoutType());
  const shown = useMemo(() => rows.filter((row) => matchesColumns(row, filters, filterColumns)), [rows, filters]);
  const { results, paginationProps } = usePagedRows(shown, filters);
  const text = (column: string) => (row: ReportRow) => String(row[column] ?? '');
  const columns: Array<{
    header: string;
    render: (row: ReportRow) => React.ReactNode;
    csv: (row: ReportRow) => string;
  }> = [
    {
      header: t('patient', 'Patient'),
      render: (row) => (
        <ConfigurableLink to={patientChartUrl(row.patient_uuid)} className={styles.name}>
          {text('full_name')(row)}
        </ConfigurableLink>
      ),
      csv: text('full_name'),
    },
    { header: t('actId', 'ACT ID'), render: text('rhd_id'), csv: text('rhd_id') },
    { header: t('study', 'Study'), render: text('study'), csv: text('study') },
    { header: t('studyId', 'Study ID'), render: text('study_id'), csv: text('study_id') },
    {
      header: t('enrollmentDate', 'Enrollment date'),
      render: (row) => reportDate(row.date_enrolled),
      csv: (row) => reportDate(row.date_enrolled),
    },
    {
      header: t('completionDate', 'Completion date'),
      render: (row) => reportDate(row.date_completed),
      csv: (row) => reportDate(row.date_completed),
    },
    {
      header: t('studyStatus', 'Study status'),
      render: (row) =>
        row.status ? (
          <Tag size="sm" type={Number(row.active) === 1 ? 'green' : 'gray'}>
            {text('status')(row)}
          </Tag>
        ) : null,
      csv: text('status'),
    },
    {
      header: t('primaryCareClinic', 'Primary care clinic'),
      render: text('primary_care_clinic'),
      csv: text('primary_care_clinic'),
    },
    { header: t('cardiacClinic', 'Cardiac clinic'), render: text('cardiac_clinic'), csv: text('cardiac_clinic') },
  ];

  let body: React.ReactNode;
  if (error) {
    body = (
      <InlineNotification
        kind="error"
        lowContrast
        hideCloseButton
        title={t('couldNotLoadParticipants', 'Could not load the study participants')}
      />
    );
  } else if (isLoading) {
    body = (
      <DataTableSkeleton
        role="progressbar"
        columnCount={columns.length}
        compact={desktop}
        showHeader={false}
        showToolbar={false}
      />
    );
  } else if (!rows.length) {
    body = <TableEmptyState message={t('noParticipants', 'There are no study participants to display')} />;
  } else {
    body = (
      <>
        <div className={styles.filters}>
          <FilterSelect
            id="participants-study"
            label={t('study', 'Study')}
            value={filters.study}
            options={distinctValues(rows, 'study')}
            onChange={(value) => setFilters({ study: value })}
          />
          <FilterSelect
            id="participants-status"
            label={t('studyStatus', 'Study status')}
            value={filters.status}
            options={distinctValues(rows, 'status')}
            onChange={(value) => setFilters({ status: value })}
          />
          <DownloadCsvButton
            name="study-participants"
            headers={columns.map((column) => column.header)}
            rows={() => shown.map((row) => columns.map((column) => column.csv(row)))}
            disabled={!shown.length}
          />
        </div>
        {shown.length ? (
          <div className={styles.tableContainer}>
            <Table
              aria-label={t('studyParticipants', 'Study participants')}
              size={desktop ? 'sm' : 'lg'}
              useZebraStyles
            >
              <TableHead>
                <TableRow>
                  {columns.map((column) => (
                    <TableHeader key={column.header}>{column.header}</TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {results.map((row) => (
                  <TableRow key={String(row.enrollment_uuid)}>
                    {columns.map((column) => (
                      <TableCell key={column.header}>{column.render(row)}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination {...paginationProps} />
          </div>
        ) : (
          <FilterEmptyState message={t('noParticipantMatches', 'No participants to display')} />
        )}
      </>
    );
  }

  return (
    <section>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>{t('studyParticipants', 'Study participants')}</h2>
      </div>
      {body}
    </section>
  );
}

/** ACT 2.0's Study Management and Study Participants: the studies, and every enrolment in them. */
export default function Studies() {
  const { t } = useTranslation();
  const { participantsReport } = useConfig<Config>().studies;
  const { rows, isLoading, error } = useReportDataset(participantsReport);
  const [filters, setFilters] = useUrlFilters(filterKeys);
  return (
    <>
      <ActPageHeader title={t('studies', 'Studies')} illustration={<CohortsPictogram />} />
      <div className={styles.studies}>
        <StudiesTable rows={rows} onOpen={(study) => setFilters({ study: study.name, status: '' })} />
        <ParticipantsTable rows={rows} isLoading={isLoading} error={error} filters={filters} setFilters={setFilters} />
      </div>
    </>
  );
}
