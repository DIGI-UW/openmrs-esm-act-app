import React, { useMemo } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import {
  Button,
  DataTableSkeleton,
  InlineNotification,
  Pagination,
  Search,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
import { useScreenAccess } from '../access/screen-access.component';
import { flagPriority, isListedFlag } from '../rhd-flags/rhd-flag-lists.resource';
import { useReportDataset, type ReportRow } from '../reports/report-dataset.resource';
import { parseReportDate } from '../reports/report-date';
import { downloadCsv } from '../table-filters/csv';
import { FilterSelect } from '../table-filters/filter-select.component';
import { distinctValues } from '../table-filters/distinct-values';
import { usePagedRows } from '../table-filters/paged-rows';
import { filterRegistry, registryFilterColumns, rowFlags, useRegistryFilters } from './registry-filters';
import { AdherenceRing } from './adherence-ring.component';
import { BpgStatusTag, bpgStatuses, useBpgStatusLabel } from './bpg-status-tag.component';
import { RegistryFlags } from './registry-flags.component';
import { FilterEmptyState, TableEmptyState } from '../table-filters/empty-state.component';
import styles from './registry.scss';

const chartUrl = (row: ReportRow) => patientChartUrl(row.patient_uuid);

function nextConsultation(row: ReportRow) {
  const date = parseReportDate(row.next_consultation_date);
  return date ? formatDate(date, { time: false, noToday: true }) : '';
}

function RegistryTable() {
  const { t } = useTranslation();
  const { registry, flagLists } = useConfig<Config>();
  const desktop = isDesktop(useLayoutType());
  const params = useMemo(() => ({ startDate: '1900-01-01', endDate: dayjs().format('YYYY-MM-DD') }), []);
  // Coming back from a chart paints the cached rows, then evaluates the report again for what the chart changed.
  const { rows, isLoading, error } = useReportDataset(registry.report, params);
  const [filters, setFilters, filtersPending] = useRegistryFilters();
  // A BPG status in the URL has no filter to clear it while the setting is off, so it is not applied.
  const shown = useMemo(
    () => filterRegistry(rows, registry.showBpgColumns ? filters : { ...filters, bpg: '' }),
    [rows, filters, registry.showBpgColumns],
  );
  const { results, paginationProps } = usePagedRows(shown, filters);
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
      .map((flagName) => ({ flagName, priority: flagPriority(flagLists, flagName) }));
  const flagOptions = [...new Set(rows.flatMap((row) => flagsOf(row).map((list) => list.flagName)))].sort();
  const text = (column: string) => (row: ReportRow) => String(row[column] ?? '');
  // The CSV keeps each report field in its own column.
  const csvColumns: Array<{ header: string; text: (row: ReportRow) => string }> = [
    { header: t('name', 'Name'), text: text('full_name') },
    { header: t('actId', 'ACT ID'), text: text('rhd_id') },
    { header: t('age', 'Age'), text: text('age_years') },
    { header: t('sex', 'Sex'), text: text('sex') },
    { header: t('diagnosisCategory', 'Diagnosis category'), text: text('diagnosis_category') },
    { header: t('prophylaxisRegimen', 'Prophylaxis regimen'), text: text('prophylaxis_regimen') },
    { header: t('nextConsultation', 'Next consultation'), text: nextConsultation },
    ...(registry.showBpgColumns
      ? [
          { header: t('bpgStatus', 'BPG status'), text: text('bpg_status') },
          {
            header: t('adherence', 'Adherence'),
            text: (row: ReportRow) => (row.adherence == null ? '' : `${row.adherence}%`),
          },
        ]
      : []),
    {
      header: t('flags', 'Flags'),
      text: (row) =>
        flagsOf(row)
          .map((list) => list.flagName)
          .join('; '),
    },
  ];
  const columns: Array<{ header: string; render: (row: ReportRow, index: number) => React.ReactNode }> = [
    {
      header: t('patient', 'Patient'),
      render: (row) => (
        <>
          <ConfigurableLink to={chartUrl(row)} className={styles.name}>
            {text('full_name')(row)}
          </ConfigurableLink>
          <span className={styles.actId}>{text('rhd_id')(row)}</span>
        </>
      ),
    },
    {
      header: t('ageSex', 'Age, sex'),
      render: (row) => [text('age_years')(row), text('sex')(row)].filter(Boolean).join(' '),
    },
    { header: t('diagnosis', 'Diagnosis'), render: text('diagnosis_category') },
    { header: t('prophylaxis', 'Prophylaxis'), render: text('prophylaxis_regimen') },
    ...(registry.showBpgColumns
      ? [
          { header: t('bpgStatus', 'BPG status'), render: (row: ReportRow) => <BpgStatusTag row={row} /> },
          {
            header: t('adherence', 'Adherence'),
            render: (row: ReportRow) =>
              row.adherence == null ? null : <AdherenceRing value={Number(row.adherence)} />,
          },
        ]
      : []),
    {
      header: t('flags', 'Flags'),
      render: (row, index) => <RegistryFlags flags={flagsOf(row)} rowsBelow={results.length - 1 - index} />,
    },
  ];

  if (error) {
    return (
      <InlineNotification
        kind="error"
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
          labelText={t('searchRegistry', 'Search by name or ACT ID')}
          placeholder={t('searchRegistry', 'Search by name or ACT ID')}
          value={filters.q}
          onChange={(event) => setFilters({ q: event.target.value })}
        />
        {filterSelect('status', t('status', 'Status'))}
        {filterSelect('cardiac', t('cardiacClinic', 'Cardiac clinic'))}
        {filterSelect('primaryCare', t('primaryCareClinic', 'Primary care clinic'))}
        {filterSelect('category', t('categoryAtDiagnosis', 'Category at diagnosis'))}
        {registry.showBpgColumns && (
          <FilterSelect
            id="registry-bpg"
            label={t('bpgStatus', 'BPG status')}
            value={filters.bpg}
            options={bpgStatuses}
            optionLabel={bpgStatusLabel}
            onChange={(value) => setFilters({ bpg: value })}
          />
        )}
        <FilterSelect
          id="registry-flag"
          label={t('rhdFlag', 'RHD flag')}
          value={filters.flag}
          options={flagOptions}
          onChange={(value) => setFilters({ flag: value })}
        />
      </div>
      <div className={styles.actions}>
        <Button
          kind="tertiary"
          size="sm"
          disabled={!shown.length}
          onClick={() =>
            downloadCsv(
              `registry-${dayjs().format('YYYY-MM-DD')}.csv`,
              csvColumns.map((column) => column.header),
              shown.map((row) => csvColumns.map((column) => column.text(row))),
            )
          }
        >
          {t('downloadCsv', 'Download CSV')}
        </Button>
      </div>
      {shown.length ? (
        <Table size={desktop ? 'sm' : 'lg'} useZebraStyles>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableHeader key={column.header}>{column.header}</TableHeader>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {results.map((row, index) => (
              <TableRow
                key={String(row.patient_uuid)}
                className={styles.row}
                onClick={(event) =>
                  (event.target as HTMLElement).closest('a, .cds--popover-container') || navigate({ to: chartUrl(row) })
                }
              >
                {columns.map((column) => (
                  <TableCell key={column.header}>{column.render(row, index)}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <FilterEmptyState message={t('noRegistryMatches', 'No patients to display')} />
      )}
      {shown.length > 0 && <Pagination {...paginationProps} />}
    </>
  );
}

export default function Registry() {
  const { t } = useTranslation();
  const canSeeRegistry = useScreenAccess('registry');

  if (!canSeeRegistry) {
    return <p className={styles.message}>{t('noAccessToRegistry', 'You do not have access to the registry.')}</p>;
  }
  return (
    <>
      <ActPageHeader title={t('registry', 'Registry')} illustration={<PatientListsPictogram />} />
      <div className={styles.registry}>
        <RegistryTable />
      </div>
    </>
  );
}
