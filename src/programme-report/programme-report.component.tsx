import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ContentSwitcher,
  DataTableSkeleton,
  InlineNotification,
  Select,
  SelectItem,
  SkeletonText,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
  Tile,
} from '@carbon/react';
import { FacilityPictogram, isDesktop, useConfig, useLayoutType, useSession } from '@openmrs/esm-framework';
import { ActHomeCard } from '../act-home/act-home-card.component';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import { SessionLocationAndDate } from '../act-page-header/session-location-and-date.component';
import { type Config } from '../config-schema';
import { useReportDataset, type ReportRow } from '../reports/report-dataset.resource';
import { TableEmptyState } from '../table-filters/empty-state.component';
import { periods, type PeriodKind } from './period';
import { useProgrammeScope } from './programme-scope';
import { useClinics } from './clinics.resource';
import styles from './programme-report.scss';

// Carbon has no yellow tag, so Review is a gray one the stylesheet colours, as the prototype shows it.
const tagTypes = { Complete: 'green', Review: 'gray', Duplicates: 'red' } as const;

const sum = (rows: Array<ReportRow>, column: string) =>
  rows.reduce((total, row) => total + Number(row[column] ?? 0), 0);

const clinicKeys = ['cardiacClinic', 'primaryCareClinic'] as const;

/** Reports' clinic filters, as ACT 2.0's dashboard had: each any clinic of its kind, or all. */
function ClinicFilters({
  scope,
  onChange,
}: {
  scope: Record<string, string>;
  onChange: (scope: Record<string, string>) => void;
}) {
  const { t } = useTranslation();
  const { clinicLocationTags } = useConfig<Config>();
  const { sessionLocation } = useSession();
  const clinics = {
    cardiacClinic: useClinics(clinicLocationTags.cardiac),
    primaryCareClinic: useClinics(clinicLocationTags.primaryCare),
  };
  const labels = {
    cardiacClinic: t('cardiacClinic', 'Cardiac clinic'),
    primaryCareClinic: t('primaryCareClinic', 'Primary care clinic'),
  };
  return (
    <>
      {clinicKeys.map((key) => (
        <Select
          key={key}
          id={`programme-report-${key}`}
          className={styles.clinicSelect}
          labelText={labels[key]}
          size="sm"
          value={scope[key] ?? ''}
          onChange={(event) => {
            const { [key]: _, ...rest } = scope;
            onChange(event.target.value ? { ...rest, [key]: event.target.value } : rest);
          }}
        >
          <SelectItem value="" text={t('all', 'All')} />
          {/* The session's clinic while the list loads, or if it fails, so the choice never reads All when it is not. */}
          {scope[key] && !clinics[key].some((clinic) => clinic.uuid === scope[key]) && (
            <SelectItem value={scope[key]} text={sessionLocation?.display ?? scope[key]} />
          )}
          {clinics[key].map((clinic) => (
            <SelectItem key={clinic.uuid} value={clinic.uuid} text={clinic.display} />
          ))}
        </Select>
      ))}
    </>
  );
}

function ProgrammeNumbers({ clinicFilters }: { clinicFilters: boolean }) {
  const { t } = useTranslation();
  const { programmeReport } = useConfig<Config>();
  const desktop = isDesktop(useLayoutType());
  const sessionScope = useProgrammeScope(!clinicFilters);
  // The session location's clinic until a filter is changed.
  const [chosenScope, setChosenScope] = useState<Record<string, string>>();
  const scope = chosenScope ?? (sessionScope.status === 'ready' ? sessionScope.params : undefined);
  const [kind, setKind] = useState<PeriodKind>('month');
  const choices = useMemo(() => periods(kind), [kind]);
  const [chosen, setChosen] = useState<string>(choices[0].key);
  const period = choices.find((choice) => choice.key === chosen) ?? choices[0];
  // Plain dates, as a zoned midnight reads as the day before on a server behind the browser's time zone.
  const params = useMemo(
    () => ({
      startDate: period.start.format('YYYY-MM-DD'),
      endDate: period.end.format('YYYY-MM-DD'),
      ...scope,
    }),
    [period, scope],
  );
  const { rows, isLoading, error } = useReportDataset(scope ? programmeReport.report : null, params);

  const tagLabels = {
    Complete: t('dataComplete', 'Complete'),
    Review: t('dataReview', 'Review'),
    Duplicates: t('dataDuplicates', 'Duplicates'),
  };
  const timed = sum(rows, 'bpg_timed');
  const tiles = [
    { label: t('activePatients', 'Active patients'), value: sum(rows, 'active_patients') },
    { label: t('dueThisWeek', 'Due this week'), value: sum(rows, 'due_this_week'), tone: styles.blue },
    { label: t('overdue', 'Overdue'), value: sum(rows, 'overdue'), tone: styles.red },
    {
      label: t('bpgOnTimeRate', 'BPG on-time rate'),
      value: timed ? `${Math.round((sum(rows, 'bpg_on_time') / timed) * 100)}%` : '–',
      tone: styles.green,
      note: period.label,
    },
  ];

  return (
    <>
      <div className={styles.period}>
        <ContentSwitcher
          aria-label={t('periodLength', 'Period length')}
          size="sm"
          selectedIndex={kind === 'month' ? 0 : 1}
          onChange={({ name }: { name: PeriodKind }) => {
            setKind(name);
            setChosen(periods(name)[0].key);
          }}
        >
          <Switch name="month" text={t('month', 'Month')} />
          <Switch name="quarter" text={t('quarter', 'Quarter')} />
        </ContentSwitcher>
        <Select
          id="programme-report-period"
          className={styles.periodSelect}
          labelText={t('period', 'Period')}
          hideLabel
          size="sm"
          value={period.key}
          onChange={(event) => setChosen(event.target.value)}
        >
          {choices.map((choice) => (
            <SelectItem key={choice.key} value={choice.key} text={choice.label} />
          ))}
        </Select>
      </div>
      {clinicFilters && scope && (
        <div className={styles.clinicFilters}>
          <ClinicFilters scope={scope} onChange={setChosenScope} />
        </div>
      )}
      {error || sessionScope.status === 'error' ? (
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title={t('couldNotLoadReports', 'Could not load the report')}
        />
      ) : (
        <>
          <div className={styles.tiles}>
            {tiles.map((tile) => (
              <Tile key={tile.label} className={styles.tile} data-testid="report-tile">
                <span className={styles.tileLabel}>{tile.label}</span>
                {isLoading || !scope ? (
                  <SkeletonText heading width="40%" />
                ) : (
                  <span className={`${styles.tileValue} ${tile.tone ?? ''}`}>{tile.value}</span>
                )}
                {tile.note && <span className={styles.tileNote}>{tile.note}</span>}
              </Tile>
            ))}
          </div>
          <ActHomeCard title={t('byFacility', 'By facility')}>
            {isLoading || !scope ? (
              <DataTableSkeleton
                role="progressbar"
                columnCount={4}
                rowCount={4}
                compact={desktop}
                showHeader={false}
                showToolbar={false}
              />
            ) : rows.length ? (
              <div className={styles.tableContainer}>
                <Table size={desktop ? 'sm' : 'lg'}>
                  <TableHead>
                    <TableRow>
                      <TableHeader>{t('facility', 'Facility')}</TableHeader>
                      <TableHeader>{t('patients', 'Patients')}</TableHeader>
                      <TableHeader>{t('adherence', 'Adherence')}</TableHeader>
                      <TableHeader>{t('data', 'Data')}</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={String(row.facility_uuid ?? row.facility)}>
                        <TableCell>{String(row.facility ?? '')}</TableCell>
                        <TableCell>
                          {t('activeCount', '{{count}} active', { count: Number(row.active_patients ?? 0) })}
                        </TableCell>
                        <TableCell>{row.adherence == null ? '' : `${row.adherence}%`}</TableCell>
                        <TableCell>
                          <Tag
                            type={tagTypes[String(row.data_tag)] ?? 'gray'}
                            size="sm"
                            className={row.data_tag === 'Review' ? styles.review : undefined}
                          >
                            {tagLabels[String(row.data_tag)] ?? String(row.data_tag ?? '')}
                          </Tag>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <TableEmptyState message={t('noActivePatients', 'There are no active patients')} />
            )}
          </ActHomeCard>
        </>
      )}
    </>
  );
}

/**
 * The Reports page, or Facility reports: the same numbers, at the session location's clinic. Reports lets the
 * clinic be changed, as ACT 2.0's dashboard did; Facility reports keeps the data clerk at their own.
 */
export function ProgrammeReport({ title, clinicFilters = false }: { title: string; clinicFilters?: boolean }) {
  return (
    <>
      <ActPageHeader title={title} illustration={<FacilityPictogram />} actions={<SessionLocationAndDate />} />
      <div className={styles.programmeReport}>
        <ProgrammeNumbers clinicFilters={clinicFilters} />
      </div>
    </>
  );
}
