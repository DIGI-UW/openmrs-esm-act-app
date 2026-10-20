import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableSkeleton, InlineNotification, Pagination, Search } from '@carbon/react';
import { Information } from '@carbon/react/icons';
import { CardiologyPictogram, isDesktop, useLayoutType } from '@openmrs/esm-framework';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import { DueForProphylaxisTable } from '../due-for-prophylaxis/due-for-prophylaxis-table.component';
import { DueListToolbar } from '../due-for-prophylaxis/due-list-toolbar.component';
import { useDueFilter } from '../due-for-prophylaxis/due-list';
import { useRecordedToday } from '../due-for-prophylaxis/recorded-today.resource';
import { bothClinics, onRegistryNow, useRegistryReport, useSessionClinicReport } from '../registry/registry.resource';
import { TableEmptyState } from '../table-filters/empty-state.component';
import { usePagedRows } from '../table-filters/paged-rows';
import { asProphylaxisRow } from './patients-on-prophylaxis';
import styles from './patients-on-prophylaxis.scss';

function PatientsOnProphylaxis() {
  const { t } = useTranslation();
  const desktop = isDesktop(useLayoutType());
  const registry = useSessionClinicReport(useRegistryReport(), bothClinics);
  const [search, setSearch] = useState('');
  // Only patients enrolled now and alive may have a dose recorded.
  const rows = useMemo(
    () => registry.rows.filter(onRegistryNow).map(asProphylaxisRow).filter(Boolean),
    [registry.rows],
  );
  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? rows.filter((row) => `${row.full_name ?? ''} ${row.rhd_id ?? ''}`.toLowerCase().includes(q)) : rows;
  }, [rows, search]);
  const { filter, setFilter, counts, filtered } = useDueFilter(searched, 'all');
  const filters = useMemo(() => ({ filter, search }), [filter, search]);
  const { results, paginationProps } = usePagedRows(filtered, filters);
  // Who was recorded today is read from the rows themselves, so the CSV knows it for every filtered row too.
  const { recorded } = useRecordedToday(filtered);

  if (registry.error) {
    return (
      <InlineNotification
        kind="error"
        lowContrast
        hideCloseButton
        title={t('couldNotLoadPatientsOnProphylaxis', 'Could not load the patients on prophylaxis')}
      />
    );
  }
  return (
    <>
      <Search
        labelText={t('searchByNameOrActId', 'Search by name or ACT ID')}
        placeholder={t('searchByNameOrActId', 'Search by name or ACT ID')}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <section className={styles.list}>
        <h2 className={styles.title}>{t('patientsOnProphylaxis', 'Patients on prophylaxis')}</h2>
        <DueListToolbar
          csvName="patients-on-prophylaxis"
          filter={filter}
          counts={counts}
          onFilter={setFilter}
          rows={filtered}
          recorded={recorded}
        />
        {registry.isLoading ? (
          <DataTableSkeleton
            role="progressbar"
            columnCount={7}
            rowCount={paginationProps.pageSize}
            compact={desktop}
            showHeader={false}
            showToolbar={false}
          />
        ) : filtered.length ? (
          <>
            <DueForProphylaxisTable rows={results} recorded={recorded} />
            {filtered.length > paginationProps.pageSizes[0] && <Pagination {...paginationProps} />}
          </>
        ) : (
          <TableEmptyState message={t('noPatientsOnProphylaxis', 'No patients on prophylaxis to display')} />
        )}
      </section>
      <p className={styles.note}>
        <Information size={16} aria-hidden="true" />
        {t(
          'recordFollowsPrescription',
          "The button follows each patient's current prescription. Prescriptions are changed in the Consultation Visit, not here.",
        )}
      </p>
    </>
  );
}

/** Enter prophylaxis: the registry's patients on prophylaxis, to choose one and record what was given today. */
export default function EnterProphylaxis() {
  const { t } = useTranslation();
  return (
    <>
      <ActPageHeader title={t('enterProphylaxis', 'Enter prophylaxis')} illustration={<CardiologyPictogram />} />
      <div className={styles.page}>
        <p className={styles.description}>
          {t('enterProphylaxisDescription', 'Choose the patient, then record what was given today')}
        </p>
        <PatientsOnProphylaxis />
      </div>
    </>
  );
}
