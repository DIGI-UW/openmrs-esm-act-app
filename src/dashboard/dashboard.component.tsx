import React, { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import {
  InlineNotification,
  SkeletonText,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { ReportsPictogram, useConfig } from '@openmrs/esm-framework';
import { ActHomeCard } from '../act-home/act-home-card.component';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import { type Config } from '../config-schema';
import { useClinics } from '../programme-report/clinics.resource';
import { ClinicFilters } from '../programme-report/programme-report.component';
import { useProgrammeScope } from '../programme-report/programme-scope';
import { useRegistryReport } from '../registry/registry.resource';
import { type ReportRow, useReportDataset } from '../reports/report-dataset.resource';
import { type Count, ofClinics, registrantCounts, waitlistCounts } from './dashboard-counts';
import styles from './dashboard.scss';

type Scope = Record<string, string>;

/** Horizontal bars, each scaled to the largest, as the care cascade draws them. */
function Bars({ counts, testId }: { counts: Array<Count>; testId: string }) {
  const { t } = useTranslation();
  if (!counts.length) {
    return <p className={styles.empty}>{t('noPatientsToCount', 'No patients to count')}</p>;
  }
  const largest = Math.max(...counts.map((count) => count.value));
  return (
    <div className={styles.bars}>
      {counts.map((count) => (
        <div key={count.label} className={styles.bar} data-testid={testId}>
          <span>{count.label}</span>
          <span className={styles.track}>
            <span
              className={styles.fill}
              style={{ width: `${largest ? Math.round((count.value / largest) * 100) : 0}%` }}
            />
          </span>
          <span className={styles.count}>{count.value}</span>
        </div>
      ))}
    </div>
  );
}

function Section({
  title,
  isLoading,
  error,
  children,
}: {
  title: string;
  isLoading: boolean;
  error?: Error;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <ActHomeCard title={title}>
      {error ? (
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title={t('couldNotLoadSection', 'Could not load {{section}}', { section: title.toLowerCase() })}
        />
      ) : isLoading ? (
        <SkeletonText paragraph lineCount={4} />
      ) : (
        children
      )}
    </ActHomeCard>
  );
}

/** The clinics chosen, by name, as the registry and waiting list name each patient's clinics. */
function useClinicNames(scope: Scope) {
  const { clinicLocationTags } = useConfig<Config>();
  const cardiac = useClinics(clinicLocationTags.cardiac);
  const primaryCare = useClinics(clinicLocationTags.primaryCare);
  return useMemo(() => {
    const name = (clinics: Array<{ uuid: string; display: string }>, uuid?: string) =>
      uuid ? (clinics.find((clinic) => clinic.uuid === uuid)?.display ?? uuid) : undefined;
    return { cardiac: name(cardiac, scope.cardiacClinic), primaryCare: name(primaryCare, scope.primaryCareClinic) };
  }, [cardiac, primaryCare, scope.cardiacClinic, scope.primaryCareClinic]);
}

/** #229: registrant status, and the sex, age band and disease category of the active registrants. */
function Registrants({ scope }: { scope: Scope }) {
  const { t } = useTranslation();
  const { rows, isLoading, error } = useRegistryReport();
  const clinics = useClinicNames(scope);
  const counts = useMemo(() => registrantCounts(ofClinics(rows, clinics)), [rows, clinics]);
  return (
    <>
      <Section title={t('registrantStatus', 'Registrant status')} isLoading={isLoading} error={error}>
        <Bars counts={counts.status} testId="dashboard-status" />
      </Section>
      <Section
        title={t('activeRegistrantsCount', 'Active registrants: {{count}}', { count: counts.active })}
        isLoading={isLoading}
        error={error}
      >
        <div className={styles.columns}>
          <div>
            <h4 className={styles.subheading}>{t('sex', 'Sex')}</h4>
            <Bars counts={counts.sex} testId="dashboard-sex" />
          </div>
          <div>
            <h4 className={styles.subheading}>{t('age', 'Age')}</h4>
            <Bars counts={counts.age} testId="dashboard-age" />
          </div>
          <div>
            <h4 className={styles.subheading}>{t('diseaseCategory', 'Disease category')}</h4>
            <Bars counts={counts.category} testId="dashboard-category" />
          </div>
        </div>
      </Section>
    </>
  );
}

/** #230: the open interventional recommendations by procedure and urgency. */
function Waitlist({ scope }: { scope: Scope }) {
  const { t } = useTranslation();
  const { waitingList } = useConfig<Config>();
  const { rows, isLoading, error } = useReportDataset(waitingList.report);
  const clinics = useClinicNames(scope);
  const counts = useMemo(() => waitlistCounts(ofClinics(rows, clinics)), [rows, clinics]);
  return (
    <Section
      title={t('proceduralWaitlistCount', 'Procedural waitlist: {{count}}', { count: counts.total })}
      isLoading={isLoading}
      error={error}
    >
      {counts.rows.length ? (
        <div className={styles.tableContainer}>
          <Table size="sm" aria-label={t('proceduralWaitlist', 'Procedural waitlist')}>
            <TableHead>
              <TableRow>
                <TableHeader>{t('procedure', 'Procedure')}</TableHeader>
                {counts.urgencies.map((urgency) => (
                  <TableHeader key={urgency}>{urgency}</TableHeader>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {counts.rows.map((row) => (
                <TableRow key={row.procedure} data-testid="dashboard-waitlist-row">
                  <TableCell>{row.procedure}</TableCell>
                  {row.counts.map((count, index) => (
                    <TableCell key={counts.urgencies[index]}>{count}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className={styles.empty}>{t('nobodyWaiting', 'Nobody is waiting for a procedure')}</p>
      )}
    </Section>
  );
}

/** #231: ACT 2.0's medical optimisation, done against not done. */
function Optimisation({ params }: { params: Scope }) {
  const { t } = useTranslation();
  const { dashboard } = useConfig<Config>();
  const { rows, isLoading, error } = useReportDataset(dashboard.medicalOptimisationReport, params);
  const labels: Record<string, string> = {
    consultations: t('consultationsLastYear', 'Consultations in the last year'),
    echocardiogram: t('echoLast13Months', 'Echocardiogram in the last 13 months'),
    retainedInCare: t('retainedInCare', 'Retained in care (seen in the last 7 months)'),
    interventionAssigned: t('interventionAssigned', 'Intervention assigned'),
    interventions: t('interventionsCompleted', 'Interventions completed'),
    warfarin: t('inrLast90Days', 'On warfarin, with an INR in the last 90 days'),
  };
  return (
    <Section title={t('medicalOptimisation', 'Medical optimisation')} isLoading={isLoading} error={error}>
      <div className={styles.bars}>
        {rows.map((row: ReportRow) => {
          const done = Number(row.done ?? 0);
          const notDone = row.not_done === null || row.not_done === undefined ? null : Number(row.not_done);
          const total = notDone === null ? null : done + notDone;
          return (
            <div key={String(row.measure)} className={styles.measure} data-testid="dashboard-measure">
              <span>{labels[String(row.measure)] ?? String(row.measure)}</span>
              {total === null ? (
                <span className={styles.count}>{done}</span>
              ) : (
                <>
                  <span className={styles.track} title={t('doneOfTotal', '{{done}} of {{total}}', { done, total })}>
                    <span
                      className={styles.fill}
                      style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }}
                    />
                  </span>
                  <span className={styles.count}>{t('doneOfTotal', '{{done}} of {{total}}', { done, total })}</span>
                </>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/** #232: the screening cascade, and the diagnoses of the screen-detected. */
function Screening({ params }: { params: Scope }) {
  const { t } = useTranslation();
  const { dashboard } = useConfig<Config>();
  const cascade = useReportDataset(dashboard.screeningCascadeReport, params);
  const diagnoses = useReportDataset(dashboard.screeningDiagnosesReport, params);
  const steps = cascade.rows.map((row) => ({ label: String(row.step), value: Number(row.patients ?? 0) }));
  const byBreakdown = (breakdown: string, column: string) =>
    diagnoses.rows
      .filter((row) => row.breakdown === breakdown)
      .map((row) => ({ label: String(row[column] ?? t('none', 'None')), value: Number(row.patients ?? 0) }));
  return (
    <Section
      title={t('screening', 'Screening')}
      isLoading={cascade.isLoading || diagnoses.isLoading}
      error={cascade.error ?? diagnoses.error}
    >
      <div className={styles.columns}>
        <div>
          <h4 className={styles.subheading}>{t('screeningCascade', 'Screening cascade')}</h4>
          <Bars counts={steps} testId="dashboard-screening-step" />
        </div>
        <div>
          <h4 className={styles.subheading}>{t('screenDetectedDiagnoses', 'Diagnoses of the screen-detected')}</h4>
          <Bars counts={byBreakdown('category', 'category')} testId="dashboard-screening-category" />
        </div>
        <div>
          <h4 className={styles.subheading}>{t('screenDetectedRhd', 'RHD details of the screen-detected')}</h4>
          <Bars counts={byBreakdown('rhdDetails', 'details')} testId="dashboard-screening-details" />
        </div>
      </div>
    </Section>
  );
}

/**
 * ACT 2.0's Dashboard: registrant status and demographics, the procedural waitlist, medical optimisation and
 * screening, for the clinics chosen, opening on the session's clinic as Reports does. ACT 2.0's run charts and its
 * monthly screening counts are not here yet (#194, #184).
 */
export default function Dashboard() {
  const { t } = useTranslation();
  const sessionScope = useProgrammeScope(false);
  const [chosenScope, setChosenScope] = useState<Scope>();
  const scope = chosenScope ?? (sessionScope.status === 'ready' ? sessionScope.params : undefined);
  // A plain date, as a zoned midnight reads as the day before on a server behind the browser's time zone.
  const params = useMemo(() => (scope ? { endDate: dayjs().format('YYYY-MM-DD'), ...scope } : null), [scope]);

  return (
    <div className={styles.page}>
      <ActPageHeader title={t('dashboard', 'Dashboard')} illustration={<ReportsPictogram />} />
      <div className={styles.content}>
        {sessionScope.status === 'error' ? (
          <InlineNotification
            kind="error"
            lowContrast
            hideCloseButton
            title={t('couldNotLoadDashboard', 'Could not load the dashboard')}
          />
        ) : !scope ? (
          <SkeletonText paragraph lineCount={6} />
        ) : (
          <>
            <div className={styles.filters}>
              <ClinicFilters scope={scope} onChange={setChosenScope} idPrefix="dashboard" />
            </div>
            <div className={styles.grid}>
              <Registrants scope={scope} />
              <Waitlist scope={scope} />
              <Optimisation params={params} />
              <Screening params={params} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
