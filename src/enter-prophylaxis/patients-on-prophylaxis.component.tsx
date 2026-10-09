import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTableSkeleton, InlineNotification, Pagination, Search } from '@carbon/react';
import { Information } from '@carbon/react/icons';
import { CardiologyPictogram, isDesktop, useLayoutType, useSession } from '@openmrs/esm-framework';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import { DueForProphylaxisTable } from '../due-for-prophylaxis/due-for-prophylaxis-table.component';
import { DueListToolbar } from '../due-for-prophylaxis/due-list-toolbar.component';
import { useDueFilter } from '../due-for-prophylaxis/due-list';
import { useRecordedToday } from '../due-for-prophylaxis/recorded-today.resource';
import { useRegistryReport } from '../registry/registry.resource';
import { TableEmptyState } from '../table-filters/empty-state.component';
import { usePagedRows } from '../table-filters/paged-rows';
import { asProphylaxisRow } from './patients-on-prophylaxis';
import styles from './patients-on-prophylaxis.scss';

function PatientsOnProphylaxis() {
  const { t } = useTranslation();
  const desktop = isDesktop(useLayoutType());
  const registry = useRegistryReport();
  const [search, setSearch] = useState('');
  const rows = useMemo(() => registry.rows.map(asProphylaxisRow).filter(Boolean), [registry.rows]);
  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? rows.filter((row) => `${row.full_name ?? ''} ${row.rhd_id ?? ''}`.toLowerCase().includes(q)) : rows;
  }, [rows, search]);
  const { filter, setFilter, counts, filtered } = useDueFilter(searched, 'all');
  const filters = useMemo(() => ({ filter, search }), [filter, search]);
  const { results, paginationProps } = usePagedRows(filtered, filters);
  // Who was recorded today is looked up for the page shown, one request per patient.
  const shownUuids = useMemo(
    () => results.filter((row) => row.status !== 'no_prescription').map((row) => String(row.patient_uuid)),
    [results],
  );
  const { recorded, isValidating: checking, error: recordedError } = useRecordedToday(shownUuids);

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
          description={t('chooseAndRecordToday', 'Choose the patient and record what was given today')}
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
            <DueForProphylaxisTable
              rows={results}
              recorded={recorded}
              recordedError={recordedError}
              checking={checking}
            />
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

/** Enter prophylaxis: the clinic's patients on prophylaxis, to choose one and record what was given today. */
export default function EnterProphylaxis() {
  const { t } = useTranslation();
  const { sessionLocation } = useSession();
  return (
    <>
      <ActPageHeader title={t('enterProphylaxis', 'Enter prophylaxis')} illustration={<CardiologyPictogram />} />
      <div className={styles.page}>
        <p className={styles.description}>
          {t('enterProphylaxisDescription', 'Choose the patient, then record what was given today · {{clinic}}', {
            clinic: sessionLocation?.display ?? '',
          })}
        </p>
        <PatientsOnProphylaxis />
      </div>
    </>
  );
}
