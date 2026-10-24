import React, { useMemo, useRef, useState } from 'react';
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
} from '@carbon/react';
import {
  CardiologyPictogram,
  fetchCurrentPatient,
  formatDate,
  isDesktop,
  launchWorkspace2,
  showSnackbar,
  useConfig,
  useLayoutType,
} from '@openmrs/esm-framework';
import { MayEnterForm } from '../access/may-enter-form';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import { type Config } from '../config-schema';
import { useReportDataset } from '../reports/report-dataset.resource';
import { parseReportDate } from '../reports/report-date';
import { useSessionClinicKind } from '../session-clinic';
import { DownloadCsvButton } from '../table-filters/download-csv-button.component';
import { FilterSelect } from '../table-filters/filter-select.component';
import { distinctValues } from '../table-filters/distinct-values';
import { type ColumnSort, type SortValue, sortHeaderProps, sortItems } from '../table-filters/column-sort';
import { usePagedRows } from '../table-filters/paged-rows';
import { fetchForm } from '../flag-gaps/flag-gaps.resource';
import { labelUrgencies, rankWaitingRows, type WaitingRow } from './urgency';
import {
  filterColumns,
  filterWaitingList,
  type WaitingListFilters,
  useWaitingListFilters,
} from './waiting-list-filters';
import { FilterEmptyState, TableEmptyState } from '../table-filters/empty-state.component';
import styles from './waiting-list.scss';

const waitingListFormEntryWorkspace = 'act-waiting-list-form-entry-workspace';

const reportText = (column: string) => (waiting: WaitingRow) => String(waiting.row[column] ?? '') || null;

// A column's sort value, urgency by its band, the most urgent first.
const sortValues: Record<string, (waiting: WaitingRow) => SortValue> = {
  actId: reportText('rhd_id'),
  sex: reportText('sex'),
  age: ({ row }) => (row.age_years == null || row.age_years === '' ? null : Number(row.age_years)),
  dateOfBirth: ({ row }) => String(row.date_of_birth ?? '').slice(0, 10) || null,
  type: reportText('procedure_type'),
  procedure: reportText('procedure_name'),
  urgency: (waiting) => waiting.band,
  daysPending: (waiting) => waiting.daysPending,
  district: reportText('district'),
  contraindications: reportText('contraindications'),
  suitableForRepair: reportText('suitable_for_repair'),
};

export function WaitingListTable() {
  const { t } = useTranslation();
  const { waitingList, urgencyBands } = useConfig<Config>();
  const desktop = isDesktop(useLayoutType());
  const { rows: reportRows, isLoading, error, mutate } = useReportDataset(waitingList.report);
  // Named by band before anything reads them, so the column, its filter and the CSV agree.
  const rows = useMemo(() => labelUrgencies(reportRows, urgencyBands, 'label', t), [reportRows, urgencyBands, t]);
  const [filters, setFilters, filtersPending] = useWaitingListFilters();
  const clinicKind = useSessionClinicKind();
  const ranked = useMemo(
    () => rankWaitingRows(filterWaitingList(rows, filters), urgencyBands),
    [rows, filters, urgencyBands],
  );
  const [sort, setSort] = useState<ColumnSort | null>(null);
  const sorted = useMemo(() => sortItems(ranked, sort, (waiting, key) => sortValues[key](waiting)), [ranked, sort]);
  const pageKey = useMemo(() => ({ filters, sort }), [filters, sort]);
  const { results, paginationProps } = usePagedRows(sorted, pageKey);
  // Opening a row again passes the same objects, which the open workspace takes as the same form rather than
  // prompting to close it.
  const loaded = useRef(new Map<string, Promise<[Awaited<ReturnType<typeof fetchForm>>, fhir.Patient]>>());
  const openForm = async ({ row }: WaitingRow) => {
    const patientUuid = String(row.patient_uuid);
    const encounterUuid = String(row.encounter_uuid);
    if (!loaded.current.has(encounterUuid)) {
      loaded.current.set(
        encounterUuid,
        Promise.all([fetchForm(String(row.form_uuid)), fetchCurrentPatient(patientUuid)]),
      );
    }
    try {
      const [form, patient] = await loaded.current.get(encounterUuid);
      // An edit loads its encounter's own visit, so the list passes none. Both form engines report a save
      // through mutateVisitContext.
      launchWorkspace2(
        waitingListFormEntryWorkspace,
        { form, encounterUuid },
        { patient, patientUuid, visitContext: null, mutateVisitContext: mutate },
      );
    } catch (e) {
      loaded.current.delete(encounterUuid);
      showSnackbar({ kind: 'error', title: t('couldNotOpenForm', 'Could not open the form'), subtitle: e?.message });
    }
  };
  const filterSelect = (key: keyof WaitingListFilters, label: string) => (
    <FilterSelect
      id={`waiting-list-${key}`}
      label={label}
      value={filters[key]}
      options={distinctValues(rows, filterColumns[key])}
      onChange={(value) => setFilters({ [key]: value })}
    />
  );
  const text = (column: string) => (waiting: WaitingRow) => String(waiting.row[column] ?? '');
  const columns: Array<{ key: string; header: string; text: (waiting: WaitingRow) => string; daysPending?: boolean }> =
    [
      { key: 'actId', header: t('actId', 'ACT ID'), text: text('rhd_id') },
      { key: 'sex', header: t('sex', 'Sex'), text: text('sex') },
      { key: 'age', header: t('age', 'Age'), text: text('age_years') },
      {
        key: 'dateOfBirth',
        header: t('dateOfBirth', 'Date of birth'),
        text: (waiting) => {
          const born = parseReportDate(waiting.row.date_of_birth);
          return born ? formatDate(born, { time: false, noToday: true }) : '';
        },
      },
      { key: 'type', header: t('procedureType', 'Type'), text: text('procedure_type') },
      { key: 'procedure', header: t('procedure', 'Procedure'), text: text('procedure_name') },
      { key: 'urgency', header: t('urgency', 'Urgency'), text: text('urgency') },
      {
        key: 'daysPending',
        header: t('daysPending', 'Days pending'),
        text: (waiting) => String(waiting.daysPending ?? ''),
        daysPending: true,
      },
      { key: 'district', header: t('district', 'District'), text: text('district') },
      {
        key: 'contraindications',
        header: t('contraindications', 'Contraindications'),
        text: text('contraindications'),
      },
      {
        key: 'suitableForRepair',
        header: t('suitableForRepair', 'Suitable for repair'),
        text: text('suitable_for_repair'),
      },
    ];

  // Where the session location's kind cannot be read, opening on every clinic would show patients not its own.
  if (error || clinicKind === 'error') {
    return (
      <InlineNotification
        kind="error"
        lowContrast
        hideCloseButton
        title={t('couldNotLoadWaitingList', 'Could not load the procedural waiting list')}
      />
    );
  }
  // Until the session's clinic is known, the list would show every clinic's recommendations.
  if (isLoading || filtersPending) {
    return (
      <DataTableSkeleton
        role="progressbar"
        columnCount={columns.length + 1}
        rowCount={paginationProps.pageSize}
        compact={desktop}
        zebra
        showHeader={false}
        showToolbar={false}
      />
    );
  }
  if (!rows.length) {
    return (
      <TableEmptyState message={t('noWaitingRecommendations', 'There are no procedural recommendations to display')} />
    );
  }
  return (
    <>
      <div className={styles.filters}>
        {filterSelect('cardiac', t('cardiacClinic', 'Cardiac clinic'))}
        {filterSelect('primaryCare', t('primaryCareClinic', 'Primary care clinic'))}
        {filterSelect('type', t('procedureTypeFilter', 'Procedure type'))}
        {filterSelect('procedure', t('specificProcedure', 'Specific procedure'))}
        {filterSelect('urgency', t('urgency', 'Urgency'))}
      </div>
      <div className={styles.actions}>
        <DownloadCsvButton
          name="waiting-list"
          list={`worklist:${t('waitingList', 'Procedural waiting list')}`}
          identifiers
          filters={filters}
          headers={columns.map((column) => column.header)}
          rows={() => sorted.map((waiting) => columns.map((column) => column.text(waiting)))}
          disabled={!sorted.length}
        />
      </div>
      {ranked.length ? (
        <div className={styles.tableContainer}>
          <Table size={desktop ? 'sm' : 'lg'} useZebraStyles>
            <TableHead>
              <TableRow>
                {columns.map((column) => (
                  <TableHeader key={column.key} {...sortHeaderProps(sort, column.key, setSort)}>
                    {column.header}
                  </TableHeader>
                ))}
                <TableHeader aria-label={t('actions', 'Actions')} />
              </TableRow>
            </TableHead>
            <TableBody>
              {results.map((waiting) => (
                <TableRow key={String(waiting.row.recommendation_uuid)} data-overdue={waiting.overdue}>
                  {columns.map((column) => (
                    <TableCell key={column.header} data-days-pending={column.daysPending}>
                      {column.text(waiting)}
                    </TableCell>
                  ))}
                  <TableCell>
                    <MayEnterForm formUuid={String(waiting.row.form_uuid)}>
                      <Button kind="ghost" size="sm" onClick={() => openForm(waiting)}>
                        {t('openForm', 'Open form')}
                      </Button>
                    </MayEnterForm>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <FilterEmptyState message={t('noWaitingListMatches', 'No recommendations to display')} />
      )}
      {ranked.length > 0 && <Pagination {...paginationProps} />}
    </>
  );
}

export default function WaitingList() {
  const { t } = useTranslation();
  return (
    <>
      <ActPageHeader title={t('waitingList', 'Procedural waiting list')} illustration={<CardiologyPictogram />} />
      <div className={styles.waitingList}>
        <p className={styles.description}>
          {t(
            'waitingListDescription',
            'Open procedural recommendations from the latest consultation · red rows are past the deadline for their urgency',
          )}
        </p>
        <WaitingListTable />
      </div>
    </>
  );
}
