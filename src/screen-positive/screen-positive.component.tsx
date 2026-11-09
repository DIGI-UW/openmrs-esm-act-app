import React, { useMemo, useState } from 'react';
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
  ConfigurableLink,
  formatDate,
  isDesktop,
  useConfig,
  useLayoutType,
  UserHasAccess,
} from '@openmrs/esm-framework';
import { MayEnterForm } from '../access/may-enter-form';
import { useOpenFormBesideList } from '../open-form-beside-list';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import { type Config } from '../config-schema';
import { patientChartUrl } from '../patient-chart-url';
import { useReportDataset, type ReportRow } from '../reports/report-dataset.resource';
import { parseReportDate } from '../reports/report-date';
import { useSessionClinicKind } from '../session-clinic';
import { FilterSelect } from '../table-filters/filter-select.component';
import { distinctValues } from '../table-filters/distinct-values';
import { type ColumnSort, type SortValue, sortHeaderProps, sortItems } from '../table-filters/column-sort';
import { usePagedRows } from '../table-filters/paged-rows';
import {
  filterColumns,
  filterScreenPositive,
  type ScreenPositiveFilters,
  useScreenPositiveFilters,
} from './screen-positive-filters';
import { FilterEmptyState, TableEmptyState } from '../table-filters/empty-state.component';
import styles from './screen-positive.scss';

function screenDate(row: ReportRow) {
  const date = parseReportDate(row.screen_date);
  return date ? formatDate(date, { time: false, noToday: true }) : '';
}

const reportText = (column: string) => (row: ReportRow) => String(row[column] ?? '') || null;

// A column's sort value, the date of positive screen by its day.
const sortValues: Record<string, (row: ReportRow) => SortValue> = {
  patient: reportText('full_name'),
  screened: (row) => String(row.screen_date ?? '').slice(0, 10) || null,
  screeningSite: reportText('screening_site'),
};

const screenPositiveFormEntryWorkspace = 'act-screen-positive-form-entry-workspace';

export function ScreenPositiveTable() {
  const { t } = useTranslation();
  const { screenPositive } = useConfig<Config>();
  const desktop = isDesktop(useLayoutType());
  const { rows, isLoading, error, mutate } = useReportDataset(screenPositive.report);
  // Opens the row's form to edit beside the list, where saved Diagnosis Details take the patient off it.
  const recordDiagnosis = useOpenFormBesideList(screenPositiveFormEntryWorkspace, mutate);
  const [filters, setFilters, filtersPending] = useScreenPositiveFilters();
  const clinicKind = useSessionClinicKind();
  const [sort, setSort] = useState<ColumnSort | null>(null);
  const shown = useMemo(
    () => sortItems(filterScreenPositive(rows, filters), sort, (row, key) => sortValues[key](row)),
    [rows, filters, sort],
  );
  const pageKey = useMemo(() => ({ filters, sort }), [filters, sort]);
  const { results, paginationProps } = usePagedRows(shown, pageKey);
  const filterSelect = (key: keyof ScreenPositiveFilters, label: string) => (
    <FilterSelect
      id={`screen-positive-${key}`}
      label={label}
      value={filters[key]}
      options={distinctValues(rows, filterColumns[key])}
      onChange={(value) => setFilters({ [key]: value })}
    />
  );
  const text = (column: string) => (row: ReportRow) => String(row[column] ?? '');
  const columns: Array<{ key: string; header: string; render: (row: ReportRow) => React.ReactNode }> = [
    {
      key: 'patient',
      header: t('patient', 'Patient'),
      render: (row) => (
        <>
          <ConfigurableLink to={patientChartUrl(row.patient_uuid)} className={styles.name}>
            {String(row.full_name ?? '')}
          </ConfigurableLink>
          <span className={styles.ageSex}>{[text('age_years')(row), text('sex')(row)].filter(Boolean).join(' ')}</span>
        </>
      ),
    },
    { key: 'screened', header: t('screened', 'Screened'), render: screenDate },
    { key: 'screeningSite', header: t('screeningSite', 'Screening site'), render: text('screening_site') },
    // The follow-up status column went with the question, which AR-167 took off Patient Information.
  ];

  // Where the session location's kind cannot be read, opening on every clinic would show patients not its own.
  if (error || clinicKind === 'error') {
    return (
      <InlineNotification
        kind="error"
        statusIconDescription={t('errorIcon', 'error icon')}
        lowContrast
        hideCloseButton
        title={t('couldNotLoadScreenPositive', 'Could not load the screen positive list')}
      />
    );
  }
  // Until the session's clinic is known, the list would show every clinic's patients.
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
      <TableEmptyState
        message={t('noScreenPositivePatients', 'There are no screen positive patients waiting for a diagnosis')}
      />
    );
  }
  return (
    <>
      <div className={styles.filters}>
        {filterSelect('cardiac', t('cardiacClinic', 'Cardiac clinic'))}
        {filterSelect('primaryCare', t('primaryCareClinic', 'Primary care clinic'))}
        {filterSelect('sex', t('sex', 'Sex'))}
      </div>
      {shown.length ? (
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
              {results.map((row) => (
                <TableRow key={String(row.patient_uuid)}>
                  {columns.map((column) => (
                    <TableCell key={column.header}>{column.render(row)}</TableCell>
                  ))}
                  <TableCell>
                    {row.form_uuid && (
                      <MayEnterForm formUuid={String(row.form_uuid)}>
                        <Button kind="ghost" size="sm" onClick={() => recordDiagnosis(row)}>
                          {t('recordDiagnosis', 'Record diagnosis')}
                        </Button>
                      </MayEnterForm>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <FilterEmptyState message={t('noScreenPositiveMatches', 'No patients to display')} />
      )}
      {shown.length > 0 && <Pagination {...paginationProps} />}
    </>
  );
}

export default function ScreenPositive() {
  const { t } = useTranslation();
  return (
    <>
      <ActPageHeader title={t('diagnosisToConfirm', 'Diagnosis to confirm')} illustration={<CardiologyPictogram />} />
      <div className={styles.screenPositive}>
        <p className={styles.description}>
          {t(
            'diagnosisToConfirmDescription',
            'Screen-positive patients whose diagnosis has no details yet. Record diagnosis opens their form beside this list, where saved details take them off it.',
          )}
        </p>
        <ScreenPositiveTable />
      </div>
    </>
  );
}
