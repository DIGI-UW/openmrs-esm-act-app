import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DataTableSkeleton,
  InlineNotification,
  Pagination,
  Search,
  Table,
  TableBody,
  TableCell,
  TableExpandedRow,
  TableExpandHeader,
  TableExpandRow,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
} from '@carbon/react';
import {
  ConfigurableLink,
  formatDate,
  isDesktop,
  navigate,
  PatientListsPictogram,
  useConfig,
  useLayoutType,
} from '@openmrs/esm-framework';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import { type Config } from '../config-schema';
import { patientChartUrl } from '../patient-chart-url';
import { flagPriority, isListedFlag } from '../rhd-flags/rhd-flag-lists.resource';
import { type ReportRow } from '../reports/report-dataset.resource';
import { diagnosis } from '../reports/diagnosis';
import { parseReportDate } from '../reports/report-date';
import { DownloadCsvButton } from '../table-filters/download-csv-button.component';
import { FilterSelect } from '../table-filters/filter-select.component';
import { distinctValues } from '../table-filters/distinct-values';
import { usePagedRows } from '../table-filters/paged-rows';
import {
  filterRegistry,
  registryFilterColumns,
  type RegistryFilters,
  rowFlagDays,
  rowFlags,
  useRegistryFilters,
} from './registry-filters';
import { AdherenceRing } from './adherence-ring.component';
import { BpgStatusTag, bpgStatuses, useBpgStatusLabel } from './bpg-status-tag.component';
import { RegistryFlags } from './registry-flags.component';
import { RegistryDetails } from './registry-details.component';
import { useRegistryReport } from './registry.resource';
import { useSessionClinicScope } from '../session-clinic';
import { type RegistrySort, sortRegistry } from './registry-sort';
import { sortHeaderProps } from '../table-filters/column-sort';
import { FilterEmptyState, TableEmptyState } from '../table-filters/empty-state.component';
import styles from './registry.scss';

const chartUrl = (row: ReportRow) => patientChartUrl(row.patient_uuid);

function nextConsultation(row: ReportRow) {
  const date = parseReportDate(row.next_consultation_date);
  return date ? formatDate(date, { time: false, noToday: true }) : '';
}

function reportDate(value: unknown) {
  const date = parseReportDate(value);
  return date ? formatDate(date, { time: false, noToday: true }) : '';
}

function RegistryTable() {
  const { t } = useTranslation();
  const { registry, flagLists } = useConfig<Config>();
  const desktop = isDesktop(useLayoutType());
  // Coming back from a chart paints the cached rows, then evaluates the report again for what the chart changed.
  const { rows, isLoading, error } = useRegistryReport();
  const [filters, setFilters, filtersPending] = useRegistryFilters();
  const scope = useSessionClinicScope();
  const kind = scope.status === 'ready' ? scope.kind : 'none';
  // Each kind of clinic has its filters; a value in the URL for a filter not shown has nothing to clear it with, so
  // it is not applied.
  const offered = useMemo(
    () =>
      new Set<keyof RegistryFilters>(
        (
          {
            primaryCare: ['status', 'primaryCare', 'category', 'prophylaxis', 'flag'],
            cardiac: ['status', 'cardiac', 'primaryCare', 'category', 'bpg'],
            none: ['status', 'cardiac', 'primaryCare', 'category', 'bpg', 'flag'],
          } as const
        )[kind].filter((key) => key !== 'bpg' || registry.showBpgColumns),
      ),
    [kind, registry.showBpgColumns],
  );
  const shown = useMemo(
    () =>
      filterRegistry(
        rows,
        Object.fromEntries(
          Object.entries(filters).map(([key, value]) => [
            key,
            key === 'q' || offered.has(key as keyof RegistryFilters) ? value : '',
          ]),
        ) as RegistryFilters,
      ),
    [rows, filters, offered],
  );
  const [sort, setSort] = useState<RegistrySort | null>(null);
  const sorted = useMemo(() => sortRegistry(shown, sort), [shown, sort]);
  const { results, paginationProps } = usePagedRows(sorted, filters);
  const [expanded, setExpanded] = useState<Set<unknown>>(new Set());
  const toggle = (uuid: unknown) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(uuid)) {
        next.add(uuid);
      }
      return next;
    });
  const bpgStatusLabel = useBpgStatusLabel();
  const filterSelect = (key: Exclude<keyof typeof registryFilterColumns, 'bpg'>, label: string) => (
    <FilterSelect
      id={`registry-${key}`}
      label={label}
      value={filters[key]}
      options={distinctValues(rows, registryFilterColumns[key])}
      onChange={(value) => setFilters({ [key]: value })}
    />
  );
  // Of the flags whose patient lists each patient is on, the configured ones show.
  const flagsOf = (row: ReportRow) =>
    rowFlags(row)
      .filter((flagName) => isListedFlag(flagLists, flagName))
      .map((flagName) => ({ flagName, priority: flagPriority(flagLists, flagName), days: rowFlagDays(row, flagName) }));
  const flagOptions = [...new Set(rows.flatMap((row) => flagsOf(row).map((list) => list.flagName)))].sort();
  const text = (column: string) => (row: ReportRow) => String(row[column] ?? '');
  // The CSV keeps each report field in its own column.
  const csvColumns: Array<{ header: string; text: (row: ReportRow) => string }> = [
    { header: t('name', 'Name'), text: text('full_name') },
    { header: t('actId', 'ACT ID'), text: text('rhd_id') },
    { header: t('alternateId', 'Alternate ID'), text: text('external_id') },
    { header: t('nationalId', 'National ID'), text: text('national_id') },
    { header: t('age', 'Age'), text: text('age_years') },
    { header: t('sex', 'Sex'), text: text('sex') },
    { header: t('diagnosisCategory', 'Diagnosis category'), text: text('diagnosis_category') },
    { header: t('diagnosisDetails', 'Diagnosis details'), text: text('diagnosis_details') },
    { header: t('prophylaxisRegimen', 'Prophylaxis regimen'), text: text('prophylaxis_regimen') },
    { header: t('nextConsultation', 'Next consultation'), text: nextConsultation },
    { header: t('cardiacClinic', 'Cardiac clinic'), text: text('cardiac_clinic') },
    { header: t('primaryCareClinic', 'Primary care clinic'), text: text('primary_care_clinic') },
    { header: t('consentGiven', 'Consent given'), text: text('consent_given') },
    { header: t('lastInjection', 'Last injection'), text: text('last_injection_date') },
    { header: t('injectionDue', 'Injection due'), text: text('next_due_date') },
    ...(registry.showBpgColumns
      ? [
          { header: t('bpgStatus', 'BPG status'), text: text('bpg_status') },
          {
            header: t('adherence', 'Adherence'),
            text: (row: ReportRow) => (row.adherence == null ? '' : `${row.adherence}%`),
          },
        ]
      : []),
    { header: t('lastUpdated', 'Last updated'), text: (row) => reportDate(row.last_updated) },
    { header: t('procedureDue', 'Procedure due'), text: (row) => reportDate(row.earliest_procedure_due) },
    {
      header: t('flags', 'Flags'),
      text: (row) =>
        flagsOf(row)
          .map((list) => list.flagName)
          .join('; '),
    },
  ];
  const columns: Array<{
    header: string;
    sortKey?: RegistrySort['key'];
    render: (row: ReportRow, index: number) => React.ReactNode;
  }> = [
    {
      header: t('patient', 'Patient'),
      sortKey: 'name',
      render: (row) => (
        <>
          <ConfigurableLink to={chartUrl(row)} className={styles.name}>
            {text('full_name')(row)}
          </ConfigurableLink>
          {row.consent_given !== 'Yes' && (
            <span className={styles.notConsented} title={t('notConsented', 'Not consented')}>
              *
            </span>
          )}
          {row.enrollment_status === 'Completed' && (
            <Tag as="span" type="gray" size="sm" className={styles.inactive}>
              {t('inactive', 'Inactive')}
            </Tag>
          )}
          <span className={styles.actId}>{text('rhd_id')(row)}</span>
        </>
      ),
    },
    {
      header: t('ageSex', 'Age, sex'),
      sortKey: 'age',
      render: (row) => [text('age_years')(row), text('sex')(row)].filter(Boolean).join(' '),
    },
    { header: t('diagnosis', 'Diagnosis'), render: diagnosis },
    { header: t('prophylaxis', 'Prophylaxis'), sortKey: 'prophylaxis', render: text('prophylaxis_regimen') },
    ...(registry.showBpgColumns
      ? [
          {
            header: t('bpgStatus', 'BPG status'),
            sortKey: 'bpg' as const,
            render: (row: ReportRow) => <BpgStatusTag row={row} />,
          },
          {
            header: t('adherence', 'Adherence'),
            sortKey: 'adherence' as const,
            render: (row: ReportRow) =>
              row.adherence == null ? null : <AdherenceRing value={Number(row.adherence)} />,
          },
        ]
      : []),
    {
      header: t('lastUpdated', 'Last updated'),
      sortKey: 'lastUpdated',
      render: (row) => reportDate(row.last_updated),
    },
    {
      header: t('procedureDue', 'Procedure due'),
      sortKey: 'procedureDue',
      render: (row) => reportDate(row.earliest_procedure_due),
    },
    {
      header: t('flags', 'Flags'),
      render: (row, index) => <RegistryFlags flags={flagsOf(row)} rowsBelow={results.length - 1 - index} />,
    },
  ];

  // Where the session location's kind cannot be read, opening on every clinic would show patients not its own.
  if (error || scope.status === 'error') {
    return (
      <InlineNotification
        kind="error"
        statusIconDescription={t('errorIcon', 'error icon')}
        lowContrast
        hideCloseButton
        title={t('couldNotLoadRegistry', 'Could not load the registry')}
      />
    );
  }
  if (isLoading || filtersPending) {
    return (
      <DataTableSkeleton
        role="progressbar"
        columnCount={columns.length}
        rowCount={paginationProps.pageSize}
        compact={desktop}
        zebra
        showHeader={false}
        showToolbar={false}
      />
    );
  }
  if (!rows.length) {
    return <TableEmptyState message={t('noRegistryPatients', 'There are no registry patients to display')} />;
  }
  return (
    <>
      <div className={styles.filters}>
        <Search
          closeButtonLabelText={t('clearSearchInput', 'Clear search input')}
          labelText={t('searchRegistryWithAlternateId', 'Search by name, ACT ID or alternate ID')}
          placeholder={t('searchRegistryWithAlternateId', 'Search by name, ACT ID or alternate ID')}
          value={filters.q}
          onChange={(event) => setFilters({ q: event.target.value })}
        />
        {filterSelect('status', t('status', 'Status'))}
        {offered.has('cardiac') && filterSelect('cardiac', t('cardiacClinic', 'Cardiac clinic'))}
        {filterSelect('primaryCare', t('primaryCareClinic', 'Primary care clinic'))}
        {filterSelect('category', t('categoryAtDiagnosis', 'Category at diagnosis'))}
        {offered.has('prophylaxis') && filterSelect('prophylaxis', t('prophylaxis', 'Prophylaxis'))}
        {offered.has('bpg') && (
          <FilterSelect
            id="registry-bpg"
            label={t('bpgStatus', 'BPG status')}
            value={filters.bpg}
            options={bpgStatuses}
            optionLabel={bpgStatusLabel}
            onChange={(value) => setFilters({ bpg: value })}
          />
        )}
        {offered.has('flag') && (
          <FilterSelect
            id="registry-flag"
            label={t('rhdFlag', 'RHD flag')}
            value={filters.flag}
            options={flagOptions}
            onChange={(value) => setFilters({ flag: value })}
          />
        )}
      </div>
      <div className={styles.actions}>
        <DownloadCsvButton
          name="registry"
          list="registry"
          identifiers
          filters={filters}
          headers={csvColumns.map((column) => column.header)}
          rows={() => shown.map((row) => csvColumns.map((column) => column.text(row)))}
          disabled={!shown.length}
        />
      </div>
      {shown.length ? (
        <>
          <p className={styles.legend}>
            {t('notConsentedLegend', 'Patients marked with * have not consented to the registry')}
          </p>
          <Table size={desktop ? 'sm' : 'lg'} useZebraStyles>
            <TableHead>
              <TableRow>
                <TableExpandHeader aria-label={t('details', 'Details')} />
                {columns.map((column) =>
                  column.sortKey ? (
                    <TableHeader key={column.header} {...sortHeaderProps(sort, column.sortKey, setSort)}>
                      {column.header}
                    </TableHeader>
                  ) : (
                    <TableHeader key={column.header}>{column.header}</TableHeader>
                  ),
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {results.map((row, index) => (
                <React.Fragment key={String(row.patient_uuid)}>
                  <TableExpandRow
                    aria-label={t('details', 'Details')}
                    isExpanded={expanded.has(row.patient_uuid)}
                    onExpand={() => toggle(row.patient_uuid)}
                    className={styles.row}
                    // TableExpandRow passes onClick on to its row, though its props do not declare it.
                    {...({
                      onClick: (event) =>
                        (event.target as HTMLElement).closest('a, button, .cds--popover-container') ||
                        navigate({ to: chartUrl(row) }),
                    } as React.HTMLAttributes<HTMLTableRowElement>)}
                  >
                    {columns.map((column) => (
                      <TableCell key={column.header}>{column.render(row, index)}</TableCell>
                    ))}
                  </TableExpandRow>
                  {expanded.has(row.patient_uuid) && (
                    <TableExpandedRow colSpan={columns.length + 1}>
                      <RegistryDetails row={row} />
                    </TableExpandedRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </>
      ) : (
        <FilterEmptyState message={t('noRegistryMatches', 'No patients to display')} />
      )}
      {shown.length > 0 && <Pagination {...paginationProps} />}
    </>
  );
}

export default function Registry() {
  const { t } = useTranslation();
  const scope = useSessionClinicScope();
  const clinic = scope.status === 'ready' ? scope.clinic?.name : null;
  return (
    <>
      <ActPageHeader title={t('registry', 'Registry')} illustration={<PatientListsPictogram />} />
      <div className={styles.registry}>
        <p className={styles.description}>
          {clinic
            ? t('registryDescriptionAt', 'Patients enrolled in the RHD Registry programme at {{clinic}}', { clinic })
            : t('registryDescription', 'Patients enrolled in the RHD Registry programme')}
        </p>
        <RegistryTable />
      </div>
    </>
  );
}
