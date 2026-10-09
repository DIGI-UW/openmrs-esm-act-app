import React, { useMemo, useRef } from 'react';
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
  fetchCurrentPatient,
  formatDate,
  isDesktop,
  launchWorkspace2,
  showSnackbar,
  useConfig,
  useLayoutType,
  UserHasAccess,
} from '@openmrs/esm-framework';
import { MayEnterForm } from '../access/may-enter-form';
import { fetchForm } from '../flag-gaps/flag-gaps.resource';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import { type Config } from '../config-schema';
import { patientChartUrl } from '../patient-chart-url';
import { useReportDataset, type ReportRow } from '../reports/report-dataset.resource';
import { parseReportDate } from '../reports/report-date';
import { FilterSelect } from '../table-filters/filter-select.component';
import { distinctValues } from '../table-filters/distinct-values';
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

const screenPositiveFormEntryWorkspace = 'act-screen-positive-form-entry-workspace';

function ScreenPositiveTable() {
  const { t } = useTranslation();
  const { screenPositive } = useConfig<Config>();
  const desktop = isDesktop(useLayoutType());
  const { rows, isLoading, error, mutate } = useReportDataset(screenPositive.report);
  // Same objects on a second click, so the open workspace does not prompt to close the form.
  const loaded = useRef(new Map<string, Promise<[Awaited<ReturnType<typeof fetchForm>>, fhir.Patient]>>());
  // Opens the form that recorded the Screen + to edit, where its Diagnosis Details take the patient off the list,
  // as ACT 2.0's row opened the patient form.
  const enterDiagnosis = async (row: ReportRow) => {
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
      // An edit loads its encounter's own visit, so the list passes none.
      // Both form engines report a save through mutateVisitContext, which evaluates the list again.
      launchWorkspace2(
        screenPositiveFormEntryWorkspace,
        { form, encounterUuid },
        { patient, patientUuid, visitContext: null, mutateVisitContext: mutate },
      );
    } catch (e) {
      loaded.current.delete(encounterUuid);
      showSnackbar({ kind: 'error', title: t('couldNotOpenForm', 'Could not open the form'), subtitle: e?.message });
    }
  };
  const [filters, setFilters] = useScreenPositiveFilters();
  const shown = useMemo(() => filterScreenPositive(rows, filters), [rows, filters]);
  const { results, paginationProps } = usePagedRows(shown, filters);
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
  const columns: Array<{ header: string; render: (row: ReportRow) => React.ReactNode }> = [
    { header: t('actId', 'ACT ID'), render: text('rhd_id') },
    {
      header: t('name', 'Name'),
      render: (row) => (
        <ConfigurableLink to={patientChartUrl(row.patient_uuid)}>{String(row.full_name ?? '')}</ConfigurableLink>
      ),
    },
    { header: t('age', 'Age'), render: text('age_years') },
    { header: t('sex', 'Sex'), render: text('sex') },
    { header: t('cardiacClinic', 'Cardiac clinic'), render: text('cardiac_clinic') },
    { header: t('primaryCareClinic', 'Primary care clinic'), render: text('primary_care_clinic') },
    { header: t('dateOfPositiveScreen', 'Date of positive screen'), render: screenDate },
  ];

  if (error) {
    return (
      <InlineNotification
        kind="error"
        lowContrast
        hideCloseButton
        title={t('couldNotLoadScreenPositive', 'Could not load the screen positive list')}
      />
    );
  }
  if (isLoading) {
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
        {filterSelect('sex', t('sex', 'Sex'))}
      </div>
      {shown.length ? (
        <div className={styles.tableContainer}>
          <Table size={desktop ? 'sm' : 'lg'} useZebraStyles>
            <TableHead>
              <TableRow>
                {columns.map((column) => (
                  <TableHeader key={column.header}>{column.header}</TableHeader>
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
                        <Button kind="ghost" size="sm" onClick={() => enterDiagnosis(row)}>
                          {t('enterDiagnosis', 'Enter diagnosis')}
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
      <ActPageHeader title={t('confirmatoryEchoDue', 'Confirmatory echo due')} illustration={<CardiologyPictogram />} />
      <div className={styles.screenPositive}>
        <p className={styles.description}>
          {t('confirmatoryEchoDueDescription', 'Screen-positive patients awaiting confirmatory echo')}
        </p>
        <ScreenPositiveTable />
      </div>
    </>
  );
}
