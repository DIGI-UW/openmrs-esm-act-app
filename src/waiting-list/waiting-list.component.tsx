import React, { useMemo, useRef } from 'react';
import dayjs from 'dayjs';
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
  launchWorkspace2,
  showSnackbar,
  useConfig,
} from '@openmrs/esm-framework';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import { type Config } from '../config-schema';
import { useScreenAccess } from '../access/screen-access.component';
import { useReportDataset } from '../reports/report-dataset.resource';
import { downloadCsv } from '../table-filters/csv';
import { FilterSelect } from '../table-filters/filter-select.component';
import { distinctValues } from '../table-filters/distinct-values';
import { usePagedRows } from '../table-filters/paged-rows';
import { fetchForm } from '../flag-gaps/flag-gaps.resource';
import { rankWaitingRows, type WaitingRow } from './urgency';
import {
  filterColumns,
  filterWaitingList,
  type WaitingListFilters,
  useWaitingListFilters,
} from './waiting-list-filters';
import styles from './waiting-list.scss';

const waitingListFormEntryWorkspace = 'act-waiting-list-form-entry-workspace';

function WaitingListTable() {
  const { t } = useTranslation();
  const { waitingList, urgencyBands } = useConfig<Config>();
  const { rows, isLoading, error, mutate } = useReportDataset(waitingList.report);
  const [filters, setFilters] = useWaitingListFilters();
  const ranked = useMemo(
    () => rankWaitingRows(filterWaitingList(rows, filters), urgencyBands),
    [rows, filters, urgencyBands],
  );
  const { results, paginationProps } = usePagedRows(ranked, filters);
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
  const columns: Array<{ header: string; text: (waiting: WaitingRow) => string; daysPending?: boolean }> = [
    { header: t('actId', 'ACT ID'), text: text('rhd_id') },
    { header: t('sex', 'Sex'), text: text('sex') },
    { header: t('age', 'Age'), text: text('age_years') },
    { header: t('procedureType', 'Type'), text: text('procedure_type') },
    { header: t('procedure', 'Procedure'), text: text('procedure_name') },
    { header: t('urgency', 'Urgency'), text: text('urgency') },
    {
      header: t('daysPending', 'Days pending'),
      text: (waiting) => String(waiting.daysPending ?? ''),
      daysPending: true,
    },
    { header: t('district', 'District'), text: text('district') },
    { header: t('contraindications', 'Contraindications'), text: text('contraindications') },
    { header: t('suitableForRepair', 'Suitable for repair'), text: text('suitable_for_repair') },
  ];

  if (error) {
    return (
      <InlineNotification
        kind="error"
        lowContrast
        hideCloseButton
        title={t('couldNotLoadWaitingList', 'Could not load the procedural waiting list')}
      />
    );
  }
  if (isLoading) {
    return (
      <div data-testid="waiting-list-loading">
        <DataTableSkeleton columnCount={columns.length} zebra showHeader={false} showToolbar={false} />
      </div>
    );
  }
  if (!rows.length) {
    return (
      <p className={styles.message}>{t('noWaitingRecommendations', 'No procedural recommendations are waiting.')}</p>
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
        <Button
          kind="tertiary"
          size="sm"
          disabled={!ranked.length}
          onClick={() =>
            downloadCsv(
              `waiting-list-${dayjs().format('YYYY-MM-DD')}.csv`,
              columns.map((column) => column.header),
              ranked.map((waiting) => columns.map((column) => column.text(waiting))),
            )
          }
        >
          {t('downloadCsv', 'Download CSV')}
        </Button>
      </div>
      {ranked.length ? (
        <div className={styles.tableContainer}>
          <Table useZebraStyles>
            <TableHead>
              <TableRow>
                {columns.map((column) => (
                  <TableHeader key={column.header}>{column.header}</TableHeader>
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
                    <Button kind="ghost" size="sm" onClick={() => openForm(waiting)}>
                      {t('openForm', 'Open form')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className={styles.message}>{t('noWaitingListMatches', 'No recommendations match these filters.')}</p>
      )}
      {ranked.length > 0 && <Pagination {...paginationProps} />}
    </>
  );
}

export default function WaitingList() {
  const { t } = useTranslation();
  const canSeeWaitingList = useScreenAccess('waitingList');

  if (!canSeeWaitingList) {
    return (
      <p className={styles.message}>
        {t('noAccessToWaitingList', 'You do not have access to the procedural waiting list.')}
      </p>
    );
  }
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
