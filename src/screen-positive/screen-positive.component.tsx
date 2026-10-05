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
  useSession,
  type Visit,
} from '@openmrs/esm-framework';
import { PRIVILEGE_ADD_ENCOUNTERS } from '../constants';
import { fetchForm } from '../flag-gaps/flag-gaps.resource';
import { findActiveVisit, startVisit } from '../visits/start-visit';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import { type Config } from '../config-schema';
import { patientChartUrl } from '../patient-chart-url';
import { useScreenAccess } from '../access/screen-access.component';
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
  const { screenPositive, visitType } = useConfig<Config>();
  const { sessionLocation } = useSession();
  const desktop = isDesktop(useLayoutType());
  const { rows, isLoading, error, mutate } = useReportDataset(screenPositive.report);
  // Same objects on a second click, so the open workspace does not prompt to close the form.
  const loaded = useRef(new Map<string, Promise<[Awaited<ReturnType<typeof fetchForm>>, fhir.Patient]>>());
  const visits = useRef(new Map<string, Visit>());
  // A click while the row is still opening is ignored, as it would start a second visit.
  const opening = useRef(new Set<string>());
  const enterEcho = async (row: ReportRow) => {
    const patientUuid = String(row.patient_uuid);
    if (opening.current.has(patientUuid)) {
      return;
    }
    opening.current.add(patientUuid);
    if (!loaded.current.has(patientUuid)) {
      loaded.current.set(
        patientUuid,
        Promise.all([fetchForm(screenPositive.echoForm), fetchCurrentPatient(patientUuid)]),
      );
    }
    try {
      const [form, patient] = await loaded.current.get(patientUuid);
      // Asked again on each click, as the visit may have ended since; the same visit keeps the same object.
      const active = await findActiveVisit(patientUuid);
      const visit =
        active && visits.current.get(patientUuid)?.uuid === active.uuid
          ? visits.current.get(patientUuid)
          : (active ?? (await startVisit(t, patientUuid, visitType, sessionLocation?.uuid)));
      visits.current.set(patientUuid, visit);
      // Both form engines report a save through mutateVisitContext, which evaluates the list again.
      launchWorkspace2(
        screenPositiveFormEntryWorkspace,
        { form, encounterUuid: '' },
        { patient, patientUuid, visitContext: visit, mutateVisitContext: mutate },
      );
    } catch (e) {
      loaded.current.delete(patientUuid);
      showSnackbar({ kind: 'error', title: t('couldNotOpenForm', 'Could not open the form'), subtitle: e?.message });
    } finally {
      opening.current.delete(patientUuid);
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
        message={t('noScreenPositivePatients', 'There are no screen positive patients waiting for a confirmatory echo')}
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
                    <UserHasAccess privilege={PRIVILEGE_ADD_ENCOUNTERS}>
                      <Button kind="ghost" size="sm" onClick={() => enterEcho(row)}>
                        {t('enterEchoResult', 'Enter echo result')}
                      </Button>
                    </UserHasAccess>
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
  const canSeeScreenPositive = useScreenAccess('screenPositive');

  if (!canSeeScreenPositive) {
    return (
      <p className={styles.message}>
        {t('noAccessToScreenPositive', 'You do not have access to the screen positive, pending confirmation list.')}
      </p>
    );
  }
  return (
    <>
      <ActPageHeader
        title={t('screenPositive', 'Screen positive, pending confirmation')}
        illustration={<CardiologyPictogram />}
      />
      <div className={styles.screenPositive}>
        <p className={styles.description}>
          {t('screenPositiveDescription', 'Registry patients who screened positive and wait for a confirmatory echo')}
        </p>
        <ScreenPositiveTable />
      </div>
    </>
  );
}
