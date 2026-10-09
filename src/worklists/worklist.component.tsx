import React, { useMemo } from 'react';
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
import { ConfigurableLink, isDesktop, navigate, useLayoutType } from '@openmrs/esm-framework';
import { patientChartUrl } from '../patient-chart-url';
import { diagnosis } from '../reports/diagnosis';
import { type ReportRow } from '../reports/report-dataset.resource';
import { useRegistryReport } from '../registry/registry.resource';
import { DownloadCsvButton } from '../table-filters/download-csv-button.component';
import { TableEmptyState } from '../table-filters/empty-state.component';
import { usePagedRows } from '../table-filters/paged-rows';
import styles from './worklist.scss';

/**
 * How the worklists slot asks each list to show itself: a tile linking to the Worklists page on ACT home, a tile that
 * chooses the list on the Worklists page, or the chosen list's patients.
 */
export interface WorklistState {
  view: 'tile' | 'choice' | 'list';
  /** A tile's link. */
  to?: string;
  /** Whether a choice is the list chosen. */
  selected?: boolean;
  onSelect?: () => void;
}

/** Red for a list of patients at risk, orange for a list of care that is due. */
export type WorklistTone = 'red' | 'orange';

/**
 * A worklist in the view its slot asks for. `count` is unknown while it loads; `error` shows on the tile, and `list`
 * is rendered only when the list is shown. Every tile opens its list on the Worklists page, so the user stays among
 * the lists, a list that has a page of its own included.
 */
export function Worklist({
  state,
  title,
  tone,
  count,
  error,
  list,
}: {
  state: WorklistState;
  title: string;
  tone: WorklistTone;
  count?: number;
  error?: Error;
  list: React.ReactNode;
}) {
  const { t } = useTranslation();
  if (state.view === 'list') {
    return <>{list}</>;
  }
  const tile = (
    <div
      data-testid="worklist-tile"
      data-tone={tone}
      className={`${styles.tile} ${styles[tone]} ${state.selected ? styles.selected : ''}`}
    >
      {error ? (
        <span className={styles.count}>
          <span aria-hidden="true">-</span>
          <span className="cds--visually-hidden">{t('couldNotLoadWorklist', 'Could not load this list')}</span>
        </span>
      ) : count === undefined ? (
        <SkeletonText heading width="2rem" />
      ) : (
        <span className={styles.count}>{count}</span>
      )}
      <span className={styles.name}>{title}</span>
    </div>
  );
  if (state.view === 'choice') {
    return (
      <button type="button" className={styles.choice} aria-pressed={!!state.selected} onClick={state.onSelect}>
        {tile}
      </button>
    );
  }
  return (
    <ConfigurableLink to={state.to} className={styles.link}>
      {tile}
    </ConfigurableLink>
  );
}

/** A patient on a worklist: the list's own row for them, and why they are on it. */
export interface WorklistEntry {
  row: ReportRow;
  why: string;
  /** Their prophylaxis as the list words it, else as the registry does. */
  prophylaxis?: string;
}

/**
 * A worklist's patients, with Download CSV: who they are, their diagnosis and prophylaxis from the registry where they
 * are on it, and why they are on this list, then the list's action for them, else Open chart.
 */
export function WorklistTable({
  title,
  csvName,
  entries,
  isLoading,
  error,
  action,
}: {
  title: string;
  csvName: string;
  entries: Array<WorklistEntry>;
  isLoading?: boolean;
  error?: Error;
  action?: (entry: WorklistEntry) => React.ReactNode;
}) {
  const { t } = useTranslation();
  const desktop = isDesktop(useLayoutType());
  const registry = useRegistryReport();
  const byPatient = useMemo(
    () => new Map(registry.rows.map((row) => [String(row.patient_uuid), row])),
    [registry.rows],
  );
  const patient = (entry: WorklistEntry) => byPatient.get(String(entry.row.patient_uuid)) ?? entry.row;
  const text = (row: ReportRow, column: string) => String(row[column] ?? '');
  const columns: Array<{ key: string; header: string; text: (entry: WorklistEntry) => string }> = [
    { key: 'patient', header: t('patient', 'Patient'), text: (entry) => text(patient(entry), 'full_name') },
    { key: 'actId', header: t('actId', 'ACT ID'), text: (entry) => text(patient(entry), 'rhd_id') },
    {
      key: 'ageSex',
      header: t('ageSex', 'Age, sex'),
      text: (entry) => `${text(patient(entry), 'age_years')} ${text(patient(entry), 'sex')}`.trim(),
    },
    { key: 'diagnosis', header: t('diagnosis', 'Diagnosis'), text: (entry) => diagnosis(patient(entry)) },
    {
      key: 'prophylaxis',
      header: t('prophylaxis', 'Prophylaxis'),
      text: (entry) => entry.prophylaxis ?? text(patient(entry), 'prophylaxis_regimen'),
    },
    { key: 'why', header: t('whyOnThisList', 'Why on this list'), text: (entry) => entry.why },
  ];
  // The ACT ID shows under the patient's name, and is a column of its own in the CSV.
  const shownColumns = columns.filter((column) => column.key !== 'actId');
  // Each worklist has its own table, so its page resets only when another list is shown, not when its rows reload.
  const listKey = useMemo(() => ({ csvName }), [csvName]);
  const { results, paginationProps } = usePagedRows(entries, listKey);

  const body = () => {
    if (error || registry.error) {
      return (
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title={t('couldNotLoadWorklistPatients', 'Could not load the worklist patients')}
        />
      );
    }
    if (isLoading || registry.isLoading) {
      return (
        <DataTableSkeleton
          role="progressbar"
          columnCount={shownColumns.length + 1}
          rowCount={5}
          compact={desktop}
          showHeader={false}
          showToolbar={false}
        />
      );
    }
    if (!entries.length) {
      return <TableEmptyState message={t('noWorklistPatients', 'There are no patients on this list to display')} />;
    }
    return (
      <>
        <div className={styles.tableContainer}>
          <Table size={desktop ? 'sm' : 'lg'}>
            <TableHead>
              <TableRow>
                {shownColumns.map((column) => (
                  <TableHeader key={column.key}>{column.header}</TableHeader>
                ))}
                <TableHeader aria-label={t('actions', 'Actions')} />
              </TableRow>
            </TableHead>
            <TableBody>
              {results.map((entry, index) => (
                <TableRow key={`${entry.row.patient_uuid}-${index}`}>
                  {shownColumns.map((column) => (
                    <TableCell key={column.key}>
                      {column.key === 'patient' ? (
                        <>
                          <span className={styles.patientName}>{column.text(entry)}</span>
                          <span className={styles.actId}>{text(patient(entry), 'rhd_id')}</span>
                        </>
                      ) : (
                        column.text(entry)
                      )}
                    </TableCell>
                  ))}
                  <TableCell>
                    {action ? (
                      action(entry)
                    ) : (
                      <Button
                        kind="tertiary"
                        size="sm"
                        onClick={() => navigate({ to: patientChartUrl(entry.row.patient_uuid) })}
                      >
                        {t('openChart', 'Open chart')}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {entries.length > paginationProps.pageSizes[0] && <Pagination {...paginationProps} />}
      </>
    );
  };

  return (
    <WorklistSection
      title={title}
      actions={
        <DownloadCsvButton
          name={csvName}
          headers={columns.map((column) => column.header)}
          rows={() => entries.map((entry) => columns.map((column) => column.text(entry)))}
          disabled={!entries.length}
          size="md"
        />
      }
    >
      {body()}
    </WorklistSection>
  );
}

/** A worklist's patients on the Worklists page: its title, any actions beside it, then the list. */
export function WorklistSection({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.patients}>
      <div className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}
