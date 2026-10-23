import React, { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import {
  Button,
  InlineNotification,
  Layer,
  SkeletonText,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tile,
} from '@carbon/react';
import { OpenmrsDatePicker, ReportsPictogram, useConfig, useLayoutType, useSession } from '@openmrs/esm-framework';
import { ActHomeCard } from '../act-home/act-home-card.component';
import { cascadeSteps } from '../act-home/care-cascade-steps';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import { type Config } from '../config-schema';
import { useClinics } from '../programme-report/clinics.resource';
import { ClinicFilters } from '../programme-report/programme-report.component';
import { useProgrammeScope } from '../programme-report/programme-scope';
import { useRegistryReport } from '../registry/registry.resource';
import { type ReportRow, useReportDataset } from '../reports/report-dataset.resource';
import { CascadeBars, CountsDonut, StackedBars } from './dashboard-charts.component';
import { type Count, ofClinics, registrantCounts, share, waitlistCounts } from './dashboard-counts';
import styles from './dashboard.scss';

type Scope = Record<string, string>;

function Bars({ counts, testId }: { counts: Array<Count>; testId: string }) {
  const { t } = useTranslation();
  if (!counts.length) {
    return <p className={styles.empty}>{t('noPatientsToCount', 'No patients to count')}</p>;
  }
  const largest = Math.max(0, ...counts.map((count) => count.value));
  return (
    <div className={styles.bars}>
      {counts.map((count) => (
        <div key={count.label} className={styles.bar} data-testid={testId}>
          <span>{count.label}</span>
          <span className={styles.track}>
            <span className={styles.fill} style={{ width: `${share(count.value, largest)}%` }} />
          </span>
          <span className={styles.count}>{count.value}</span>
        </div>
      ))}
    </div>
  );
}

interface SectionState {
  isLoading: boolean;
  error?: Error;
  retry: () => void;
  isEmpty: boolean;
}

function Section({
  title,
  name = title,
  description,
  state,
  clinic,
  onShowAll,
  wide,
  children,
}: {
  title: string;
  /** What its error calls it, where the title carries a count. */
  name?: string;
  description?: string;
  state: SectionState;
  clinic: string | null;
  onShowAll: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className={wide ? styles.wide : undefined}>
      <ActHomeCard title={title}>
        {description && <p className={styles.description}>{description}</p>}
        {state.error ? (
          <div className={styles.state}>
            <InlineNotification
              kind="error"
              lowContrast
              hideCloseButton
              title={t('couldNotLoadSection', '{{section}} could not load', { section: name })}
              subtitle={t('restOfDashboardUpToDate', 'The rest of the Dashboard is up to date.')}
            />
            <Button size="md" onClick={() => state.retry()}>
              {t('tryAgain', 'Try again')}
            </Button>
          </div>
        ) : state.isLoading ? (
          <SkeletonText paragraph lineCount={5} />
        ) : state.isEmpty ? (
          <div className={styles.state}>
            <p className={styles.empty}>
              {clinic
                ? t('nobodyAtClinicToCount', 'Nobody at {{clinic}} to count', { clinic })
                : t('noPatientsToCount', 'No patients to count')}
            </p>
            {clinic && (
              <Button kind="tertiary" size="md" onClick={onShowAll}>
                {t('showAllClinics', 'Show all clinics')}
              </Button>
            )}
          </div>
        ) : (
          children
        )}
      </ActHomeCard>
    </div>
  );
}

function FigureTile({
  label,
  value,
  note,
  isLoading,
  error,
}: {
  label: string;
  value: number | null;
  note: string;
  isLoading: boolean;
  error?: Error;
}) {
  const { t } = useTranslation();
  return (
    <Layer>
      <Tile className={styles.tile} data-testid="dashboard-tile">
        <span className={styles.tileLabel}>{label}</span>
        {isLoading ? (
          <SkeletonText heading width="4rem" />
        ) : (
          <>
            <span className={styles.tileValue}>{error || value === null ? '–' : value}</span>
            <span className={styles.tileNote}>
              {error ? t('couldNotLoad', 'could not load') : value === null ? t('notReported', 'not reported') : note}
            </span>
          </>
        )}
      </Tile>
    </Layer>
  );
}

// Named by the session too, as a limited site administrator's list can leave its clinic out.
function useClinicNames(scope: Scope) {
  const { clinicLocationTags } = useConfig<Config>();
  const { sessionLocation } = useSession();
  const cardiac = useClinics(clinicLocationTags.cardiac);
  const primaryCare = useClinics(clinicLocationTags.primaryCare);
  return useMemo(() => {
    const name = (clinics: Array<{ uuid: string; display: string }>, uuid?: string) =>
      uuid
        ? (clinics.find((clinic) => clinic.uuid === uuid)?.display ??
          (uuid === sessionLocation?.uuid ? sessionLocation.display : uuid))
        : undefined;
    return { cardiac: name(cardiac, scope.cardiacClinic), primaryCare: name(primaryCare, scope.primaryCareClinic) };
  }, [cardiac, primaryCare, scope.cardiacClinic, scope.primaryCareClinic, sessionLocation]);
}

const stateOf = (report: { isLoading: boolean; error?: Error; mutate: () => unknown }, isEmpty: boolean) => ({
  isLoading: report.isLoading,
  error: report.error,
  retry: () => void report.mutate(),
  isEmpty,
});

const allZero = (counts: Array<Count>) => counts.every((count) => !count.value);

function Figures({ scope, asOf, onShowAll }: { scope: Scope; asOf: string; onShowAll: () => void }) {
  const { t } = useTranslation();
  const { careCascade, dashboard, waitingList } = useConfig<Config>();
  const params = useMemo(() => ({ endDate: asOf, ...scope }), [asOf, scope]);
  const clinics = useClinicNames(scope);
  const clinic = [clinics.cardiac, clinics.primaryCare].filter(Boolean).join(', ') || null;

  // Read today: the registry report gives status, death and age as of now, whatever its end date.
  const registry = useRegistryReport();
  const registrants = useMemo(() => {
    const rows = ofClinics(registry.rows, clinics);
    return { registered: rows.length, ...registrantCounts(rows) };
  }, [registry.rows, clinics]);

  const cascadeReport = useReportDataset(careCascade.report, params);
  const cascade = useMemo(
    () => cascadeSteps(cascadeReport.rows, careCascade.steps),
    [cascadeReport.rows, careCascade.steps],
  );

  const waitlistReport = useReportDataset(waitingList.report);
  const waitlist = useMemo(() => {
    const rows = ofClinics(waitlistReport.rows, clinics);
    return { ...waitlistCounts(rows), patients: new Set(rows.map((row) => String(row.patient_uuid))).size };
  }, [waitlistReport.rows, clinics]);
  const phone = useLayoutType() === 'phone';
  const [waitlistAsTable, setWaitlistAsTable] = useState(phone);

  const optimisationReport = useReportDataset(dashboard.medicalOptimisationReport, params);
  const screeningReport = useReportDataset(dashboard.screeningCascadeReport, params);
  const diagnosesReport = useReportDataset(dashboard.screeningDiagnosesReport, params);

  const measureLabels: Record<string, string> = {
    consultations: t('consultationsLastYear', 'Consultations in the last year'),
    echocardiogram: t('echoLast13Months', 'Echocardiogram in the last 13 months'),
    retainedInCare: t('retainedInCare', 'Retained in care (seen in the last 7 months)'),
    interventionAssigned: t('interventionAssigned', 'Intervention assigned'),
    interventions: t('interventionsCompleted', 'Interventions completed'),
    warfarin: t('inrLast90Days', 'On warfarin, with an INR in the last 90 days'),
  };
  const measures = optimisationReport.rows.map((row: ReportRow) => {
    const done = Number(row.done ?? 0);
    const notDone = row.not_done === null || row.not_done === undefined ? null : Number(row.not_done);
    return { label: measureLabels[String(row.measure)] ?? String(row.measure), done, notDone };
  });

  const screening = screeningReport.rows.map((row) => ({ label: String(row.step), value: Number(row.patients ?? 0) }));
  const byBreakdown = (breakdown: string, column: string) =>
    diagnosesReport.rows
      .filter((row) => row.breakdown === breakdown)
      .map((row) => ({ label: String(row[column] ?? t('none', 'None')), value: Number(row.patients ?? 0) }));
  const diagnoses = byBreakdown('category', 'category');
  const rhdDetails = byBreakdown('rhdDetails', 'details');

  // By the report's step names, not careCascade.steps, which sets what the cascade section draws.
  const stepCount = (...steps: Array<string>) => {
    const row = cascadeReport.rows.find((row) => steps.includes(String(row.step)));
    return row ? Number(row.patients ?? 0) : null;
  };
  const activeRhd = stepCount('Active');
  const prescribed = stepCount('Prescribed', 'Prescribed Prophylaxis');
  const section = { clinic, onShowAll };

  return (
    <>
      <div className={styles.tiles}>
        <FigureTile
          label={t('registered', 'Registered')}
          value={registrants.registered}
          note={t('everyStatusToday', 'every status, today')}
          isLoading={registry.isLoading}
          error={registry.error}
        />
        <FigureTile
          label={t('active', 'Active')}
          value={registrants.active}
          note={t('enrolledAndAliveToday', 'enrolled and alive, today')}
          isLoading={registry.isLoading}
          error={registry.error}
        />
        <FigureTile
          label={t('onSecondaryProphylaxis', 'On secondary prophylaxis')}
          value={prescribed}
          note={
            activeRhd === null
              ? t('activeRhdNotReported', 'active RHD not reported')
              : t('shareOfActiveRhd', '{{share}}% of active RHD', { share: share(prescribed ?? 0, activeRhd) })
          }
          isLoading={cascadeReport.isLoading}
          error={cascadeReport.error}
        />
        <FigureTile
          label={t('waitingForAProcedure', 'Waiting for a procedure')}
          value={waitlist.patients}
          note={t('openRecommendations', '{{count}} open recommendations', { count: waitlist.total })}
          isLoading={waitlistReport.isLoading}
          error={waitlistReport.error}
        />
      </div>
      <div className={styles.grid}>
        <Section
          title={t('registrantStatus', 'Registrant status')}
          description={t(
            'registrantsByStatusToday',
            'All {{count}} registrants, by where their registration stands today',
            {
              count: registrants.registered,
            },
          )}
          state={stateOf(registry, !registrants.registered)}
          {...section}
        >
          <CountsDonut
            name={t('registrantStatus', 'Registrant status')}
            counts={registrants.status}
            centre={t('registrants', 'registrants')}
            testId="dashboard-status"
            withShare
          />
        </Section>
        <Section
          title={t('rhdCareCascade', 'RHD care cascade')}
          description={t('careCascadeDescription', 'Active RHD patients; each step is a share of the one before')}
          state={stateOf(cascadeReport, allZero(cascade))}
          {...section}
        >
          <CascadeBars name={t('rhdCareCascade', 'RHD care cascade')} steps={cascade} testId="dashboard-cascade-step" />
        </Section>
        <Section
          title={t('activeRegistrantsCount', 'Active registrants: {{count}}', { count: registrants.active })}
          name={t('activeRegistrants', 'Active registrants')}
          description={t('activeRegistrantsDescription', 'Sex, age and disease of the patients active today')}
          state={stateOf(registry, !registrants.active)}
          wide
          {...section}
        >
          <div className={styles.columns}>
            <div>
              <h4 className={styles.subheading}>{t('sex', 'Sex')}</h4>
              <Bars counts={registrants.sex} testId="dashboard-sex" />
            </div>
            <div>
              <h4 className={styles.subheading}>{t('age', 'Age')}</h4>
              <Bars counts={registrants.age} testId="dashboard-age" />
            </div>
            <div>
              <h4 className={styles.subheading}>{t('diseaseCategory', 'Disease category')}</h4>
              <Bars counts={registrants.category} testId="dashboard-category" />
            </div>
          </div>
        </Section>
        <Section
          title={t('proceduralWaitlistPatients', 'Procedural waitlist: {{count}} patients', {
            count: waitlist.patients,
          })}
          name={t('proceduralWaitlist', 'Procedural waitlist')}
          description={t(
            'waitlistDescription',
            "Open recommendations in each active patient's latest consultation, by urgency, today",
          )}
          state={stateOf(waitlistReport, !waitlist.total)}
          {...section}
        >
          {waitlistAsTable ? (
            <div className={styles.tableContainer}>
              <Table size="sm" aria-label={t('proceduralWaitlist', 'Procedural waitlist')}>
                <TableHead>
                  <TableRow>
                    <TableHeader>{t('procedure', 'Procedure')}</TableHeader>
                    {waitlist.urgencies.map((urgency) => (
                      <TableHeader key={urgency}>{urgency}</TableHeader>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {waitlist.rows.map((row) => (
                    <TableRow key={row.procedure} data-testid="dashboard-waitlist-row">
                      <TableCell>{row.procedure}</TableCell>
                      {row.counts.map((count, index) => (
                        <TableCell key={waitlist.urgencies[index]}>{count}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <>
              <StackedBars
                name={t('proceduralWaitlist', 'Procedural waitlist')}
                data={waitlist.urgencies.flatMap((urgency, index) =>
                  waitlist.rows
                    .filter((row) => row.counts[index])
                    .map((row) => ({ group: urgency, key: row.procedure, value: row.counts[index] })),
                )}
                groups={waitlist.urgencies}
                colours="urgency"
                height="18rem"
              />
              <ul className={styles.totals}>
                {waitlist.rows.map((row) => (
                  <li key={row.procedure} className={styles.legendRow} data-testid="dashboard-waitlist-total">
                    <span>{row.procedure}</span>
                    <span className={styles.count}>{row.counts.reduce((sum, count) => sum + count, 0)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <Button kind="ghost" size="sm" onClick={() => setWaitlistAsTable(!waitlistAsTable)}>
            {waitlistAsTable ? t('showAsAChart', 'Show as a chart') : t('showAsATable', 'Show as a table')}
          </Button>
        </Section>
        <Section
          title={t('medicalOptimisation', 'Medical optimisation')}
          state={stateOf(
            optimisationReport,
            measures.every((measure) => !measure.done && !measure.notDone),
          )}
          {...section}
        >
          <StackedBars
            name={t('medicalOptimisation', 'Medical optimisation')}
            data={measures
              .filter((measure) => measure.notDone !== null)
              .flatMap((measure) => [
                { group: t('done', 'Done'), key: measure.label, value: measure.done },
                { group: t('notDone', 'Not done'), key: measure.label, value: measure.notDone },
              ])}
            groups={[t('done', 'Done'), t('notDone', 'Not done')]}
            colours="doneNotDone"
            height="18rem"
            horizontal
          />
          <ul className={styles.totals}>
            {measures.map((measure) => (
              <li key={measure.label} className={styles.legendRow} data-testid="dashboard-measure">
                <span>{measure.label}</span>
                <span className={styles.count}>
                  {measure.notDone === null
                    ? measure.done
                    : t('doneNotDoneOf', '{{done}} done, {{notDone}} not done, of {{total}}', {
                        done: measure.done,
                        notDone: measure.notDone,
                        total: measure.done + measure.notDone,
                      })}
                </span>
              </li>
            ))}
          </ul>
        </Section>
        <Section
          title={t('screeningCascade', 'Screening cascade')}
          description={t(
            'screeningCascadeDescription',
            'Registrants found by screening, and what their confirmatory echo showed',
          )}
          state={{
            isLoading: screeningReport.isLoading || diagnosesReport.isLoading,
            error: screeningReport.error ?? diagnosesReport.error,
            retry: () => {
              if (screeningReport.error) {
                void screeningReport.mutate();
              }
              if (diagnosesReport.error) {
                void diagnosesReport.mutate();
              }
            },
            isEmpty: allZero(screening) && allZero(diagnoses),
          }}
          wide
          {...section}
        >
          <div className={styles.columns}>
            <div>
              <h4 className={styles.subheading}>{t('cascade', 'Cascade')}</h4>
              <CascadeBars
                name={t('screeningCascade', 'Screening cascade')}
                steps={screening}
                testId="dashboard-screening-step"
              />
            </div>
            <div>
              <h4 className={styles.subheading}>{t('diagnosesAfterTheEcho', 'Diagnoses after the echo')}</h4>
              <CountsDonut
                name={t('diagnosesAfterTheEcho', 'Diagnoses after the echo')}
                counts={diagnoses}
                centre={t('diagnosed', 'diagnosed')}
                testId="dashboard-screening-category"
              />
            </div>
            <div>
              <h4 className={styles.subheading}>{t('screenDetectedRhd', 'RHD details of the screen-detected')}</h4>
              <Bars counts={rhdDetails} testId="dashboard-screening-details" />
            </div>
          </div>
        </Section>
      </div>
    </>
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const sessionScope = useProgrammeScope(false);
  const [chosenScope, setChosenScope] = useState<Scope>();
  // A plain date, as a zoned midnight reads as the day before on a server behind the browser's time zone.
  const [asOf, setAsOf] = useState(() => dayjs().format('YYYY-MM-DD'));
  const scope = chosenScope ?? (sessionScope.status === 'ready' ? sessionScope.params : undefined);

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
              <OpenmrsDatePicker
                id="dashboard-as-of"
                labelText={t('figuresAsOf', 'Figures as of')}
                value={dayjs(asOf).toDate()}
                maxDate={new Date()}
                onChange={(date) => date && setAsOf(dayjs(date).format('YYYY-MM-DD'))}
              />
            </div>
            <Figures scope={scope} asOf={asOf} onShowAll={() => setChosenScope({})} />
          </>
        )}
      </div>
    </div>
  );
}
