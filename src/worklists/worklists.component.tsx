import React, { useMemo } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import {
  Button,
  DataTableSkeleton,
  InlineNotification,
  Pagination,
  SkeletonText,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { isDesktop, navigate, PatientListsPictogram, useConfig, useLayoutType } from '@openmrs/esm-framework';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import { riskFirst, WorklistAllChoice, WorklistChoice, WorklistTileGrid } from '../act-home/worklist-tiles.component';
import { type Config } from '../config-schema';
import { patientChartUrl } from '../patient-chart-url';
import { useScreenAccess } from '../access/screen-access.component';
import { rowFlags } from '../registry/registry-filters';
import { useReportDataset, type ReportRow } from '../reports/report-dataset.resource';
import { useRhdFlagLists } from '../rhd-flags/rhd-flag-lists.resource';
import { parseReportDate } from '../reports/report-date';
import { distinctValues } from '../table-filters/distinct-values';
import { FilterSelect } from '../table-filters/filter-select.component';
import { usePagedRows } from '../table-filters/paged-rows';
import { useUrlFilters } from '../table-filters/url-filters';
import { FilterEmptyState, TableEmptyState } from '../table-filters/empty-state.component';
import styles from './worklists.scss';

const filterKeys = ['flag', 'cardiac', 'primaryCare'] as const;

/** The flag value that chooses every list at once. */
const allFlags = 'all';

const DAY_MS = 24 * 60 * 60 * 1000;

interface Entry {
  row: ReportRow;
  flagName: string;
  daysOnList: number | null;
}

/** Days since the patient joined each of their flags' lists, from the report's name=YYYY-MM-DD pairs. */
function daysOnLists(row: ReportRow, today: Date) {
  const days = new Map<string, number>();
  String(row.rhd_flag_dates ?? '')
    .split('|')
    .forEach((pair) => {
      const at = pair.lastIndexOf('=');
      const since = parseReportDate(pair.slice(at + 1));
      if (at > 0 && since) {
        days.set(pair.slice(0, at), Math.round((today.getTime() - since.getTime()) / DAY_MS));
      }
    });
  return days;
}

/** A row per patient and chosen flag they are on, so a patient on two chosen lists shows twice. */
function entriesFor(rows: Array<ReportRow>, flagNames: ReadonlyArray<string>) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return rows.flatMap((row) => {
    const days = daysOnLists(row, today);
    return rowFlags(row)
      .filter((flagName) => flagNames.includes(flagName))
      .map((flagName): Entry => ({ row, flagName, daysOnList: days.get(flagName) ?? null }));
  });
}

function WorklistPatients({
  flagNames,
  showFlag,
  filters,
  setFilters,
}: {
  flagNames: ReadonlyArray<string>;
  showFlag: boolean;
  filters: Record<(typeof filterKeys)[number], string>;
  setFilters: (changes: Partial<Record<(typeof filterKeys)[number], string>>) => void;
}) {
  const { t } = useTranslation();
  const desktop = isDesktop(useLayoutType());
  const params = useMemo(() => ({ startDate: '1900-01-01', endDate: dayjs().format('YYYY-MM-DD') }), []);
  const { rows, isLoading, error } = useReportDataset('worklists', params);
  const listed = useMemo(() => entriesFor(rows, flagNames), [rows, flagNames]);
  const shown = useMemo(
    () =>
      listed.filter(
        ({ row }) =>
          (!filters.cardiac || row.cardiac_clinic === filters.cardiac) &&
          (!filters.primaryCare || row.primary_care_clinic === filters.primaryCare),
      ),
    [listed, filters.cardiac, filters.primaryCare],
  );
  const { results, paginationProps } = usePagedRows(shown, filters);
  const listedRows = listed.map((entry) => entry.row);
  const text = (column: string) => (row: ReportRow) => String(row[column] ?? '');
  const columns: Array<{ key: string; header: string; render: (entry: Entry) => React.ReactNode }> = [
    {
      key: 'patient',
      header: t('patient', 'Patient'),
      render: ({ row }) => (
        <>
          {text('full_name')(row)}
          <span className={styles.actId}>{text('rhd_id')(row)}</span>
        </>
      ),
    },
    ...(showFlag ? [{ key: 'flag', header: t('flag', 'Flag'), render: (entry: Entry) => entry.flagName }] : []),
    {
      key: 'ageSex',
      header: t('ageSex', 'Age, sex'),
      render: ({ row }) => `${text('age_years')(row)} ${text('sex')(row)}`,
    },
    { key: 'diagnosis', header: t('diagnosis', 'Diagnosis'), render: ({ row }) => text('diagnosis_category')(row) },
    {
      key: 'prophylaxis',
      header: t('prophylaxis', 'Prophylaxis'),
      render: ({ row }) => text('prophylaxis_regimen')(row),
    },
    {
      key: 'daysOnList',
      header: t('daysOnList', 'Days on list'),
      render: (entry) => (entry.daysOnList == null ? '' : String(entry.daysOnList)),
    },
    {
      key: 'open',
      header: '',
      render: ({ row }) => (
        <Button kind="tertiary" size="sm" onClick={() => navigate({ to: patientChartUrl(row.patient_uuid) })}>
          {t('openChart', 'Open chart')}
        </Button>
      ),
    },
  ];

  if (error) {
    return (
      <InlineNotification
        kind="error"
        lowContrast
        hideCloseButton
        title={t('couldNotLoadWorklistPatients', 'Could not load the worklist patients')}
      />
    );
  }
  if (isLoading) {
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
  if (!listed.length) {
    return <TableEmptyState message={t('noWorklistPatients', 'There are no patients on this list to display')} />;
  }
  return (
    <>
      <div className={styles.filters}>
        <FilterSelect
          id="worklist-cardiac"
          label={t('cardiacClinic', 'Cardiac clinic')}
          value={filters.cardiac}
          options={distinctValues(listedRows, 'cardiac_clinic')}
          onChange={(value) => setFilters({ cardiac: value })}
        />
        <FilterSelect
          id="worklist-primary-care"
          label={t('primaryCareClinic', 'Primary care clinic')}
          value={filters.primaryCare}
          options={distinctValues(listedRows, 'primary_care_clinic')}
          onChange={(value) => setFilters({ primaryCare: value })}
        />
      </div>
      {!shown.length ? (
        <FilterEmptyState message={t('noWorklistMatches', 'No patients to display')} />
      ) : (
        <>
          <div className={styles.tableContainer}>
            <Table size={desktop ? 'sm' : 'lg'} useZebraStyles>
              <TableHead>
                <TableRow>
                  {columns.map((column) => (
                    <TableHeader key={column.key}>{column.header}</TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {results.map((entry) => (
                  <TableRow key={`${entry.row.patient_uuid}-${entry.flagName}`}>
                    {columns.map((column) => (
                      <TableCell key={column.key}>{column.render(entry)}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination {...paginationProps} />
        </>
      )}
    </>
  );
}

function WorklistsContent() {
  const { t } = useTranslation();
  const { lists, isLoading, error } = useRhdFlagLists();
  const [filters, setFilters] = useUrlFilters(filterKeys);
  const ordered = riskFirst(lists);
  const all = filters.flag === allFlags;
  // A flag that is not one of the lists, or none, chooses the first list.
  const chosen = all ? null : (ordered.find((list) => list.flagName === filters.flag) ?? ordered[0]);
  const flagNames = useMemo(
    () => (chosen ? [chosen.flagName] : ordered.map((list) => list.flagName)),
    // The lists' names, not the array's identity, decide.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chosen?.flagName, ordered.map((list) => list.flagName).join('|')],
  );

  if (error) {
    return (
      <InlineNotification
        kind="error"
        lowContrast
        hideCloseButton
        title={t('couldNotLoadWorklists', 'Could not load the worklists')}
      />
    );
  }
  if (isLoading) {
    return (
      <div data-testid="worklists-loading">
        <SkeletonText paragraph lineCount={3} />
      </div>
    );
  }
  if (!ordered.length) {
    return <p className={styles.message}>{t('noRhdFlagLists', 'No RHD flag lists found')}</p>;
  }
  return (
    <>
      <WorklistTileGrid>
        <WorklistAllChoice
          count={ordered.reduce((total, list) => total + list.memberCount, 0)}
          selected={all}
          onSelect={() => setFilters({ flag: allFlags })}
        />
        {ordered.map((list) => (
          <WorklistChoice
            key={list.flagName}
            list={list}
            selected={list === chosen}
            onSelect={() => setFilters({ flag: list.flagName })}
          />
        ))}
      </WorklistTileGrid>
      <section className={styles.patients}>
        <h2 className={styles.title}>{chosen ? chosen.flagName : t('allFlags', 'All flags')}</h2>
        <WorklistPatients flagNames={flagNames} showFlag={all} filters={filters} setFilters={setFilters} />
      </section>
    </>
  );
}

export default function Worklists() {
  const { t } = useTranslation();
  const canSeeWorklists = useScreenAccess('worklists');

  if (!canSeeWorklists) {
    return <p className={styles.message}>{t('noAccessToWorklists', 'You do not have access to the worklists.')}</p>;
  }
  return (
    <>
      <ActPageHeader title={t('worklists', 'Worklists')} illustration={<PatientListsPictogram />} />
      <div className={styles.worklists}>
        <p className={styles.description}>{t('worklistsDescription', 'Patients needing action, by list')}</p>
        <WorklistsContent />
      </div>
    </>
  );
}
