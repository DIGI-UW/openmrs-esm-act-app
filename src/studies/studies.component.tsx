import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  DataTableSkeleton,
  InlineNotification,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
} from '@carbon/react';
import { Add, Edit } from '@carbon/react/icons';
import {
  ConfigurableLink,
  formatDate,
  isDesktop,
  launchWorkspace2,
  CohortsPictogram,
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
import { type Study, useStudies } from './studies.resource';
import styles from './studies.scss';

const filterKeys = ['study', 'status'] as const;
const filterColumns = { study: 'study', status: 'status' };

const reportDate = (value: unknown) => {
  const date = parseReportDate(value);
  return date ? formatDate(date, { time: false, noToday: true }) : '';
};

function StudiesTable({
  rows,
  countsUnknown,
  onOpen,
  onRenamed,
}: {
  rows: Array<ReportRow>;
  /** The participants are loading or failed to load, so no count is shown. */
  countsUnknown: boolean;
  onOpen: (study: Study) => void;
  /** Follows a study to its new name. */
  onRenamed: (from: string, to: string) => void;
}) {
  const { t } = useTranslation();
  const desktop = isDesktop(useLayoutType());
  const { studies, error, isLoading } = useStudies();
  const openForm = (study?: Study) =>
    launchWorkspace2('act-study-form-workspace', { studyUuid: study?.uuid, onRenamed });
  const count = (study: Study, activeOnly: boolean) =>
    countsUnknown
      ? '--'
      : rows.filter((row) => row.study_uuid === study.uuid && (!activeOnly || Number(row.active) === 1)).length;

  const table = error ? (
    <InlineNotification
      kind="error"
      statusIconDescription={t('errorIcon', 'error icon')}
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
                  onClick={() => openForm(study)}
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
          <Button kind="ghost" size="sm" renderIcon={Add} onClick={() => openForm()}>
            {t('createStudy', 'Create study')}
          </Button>
        </UserHasAccess>
      </div>
      {table}
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
        statusIconDescription={t('errorIcon', 'error icon')}
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
            list={`worklist:${t('studyParticipants', 'Study participants')}`}
            identifiers
            filters={filters}
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
  // A callback of fixed identity, so opening the form again is not read as new props.
  const latest = useRef({ filters, setFilters });
  latest.current = { filters, setFilters };
  const onRenamed = useCallback((from: string, to: string) => {
    if (latest.current.filters.study === from) {
      latest.current.setFilters({ study: to });
    }
  }, []);
  return (
    <>
      <ActPageHeader title={t('studies', 'Studies')} illustration={<CohortsPictogram />} />
      <div className={styles.studies}>
        <StudiesTable
          rows={rows}
          countsUnknown={isLoading || !!error}
          onOpen={(study) => setFilters({ study: study.name, status: '' })}
          onRenamed={onRenamed}
        />
        <ParticipantsTable rows={rows} isLoading={isLoading} error={error} filters={filters} setFilters={setFilters} />
      </div>
    </>
  );
}
