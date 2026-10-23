import React, { useCallback, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Trans, useTranslation } from 'react-i18next';
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
import { type ReportRow, useReportDataset } from '../reports/report-dataset.resource';
import { urlWithFilters, useUrlFilters } from '../table-filters/url-filters';
import { CascadeBars, CountLink, CountsDonut, StackedBars } from './dashboard-charts.component';
import {
  type Figure,
  FigureLinks,
  figureKeys,
  measureLabel,
  type Section as FigureSection,
  sections,
  useCountParams,
} from './dashboard-figure';
import { DashboardFigure } from './dashboard-figure.component';
import { type Count, registrantCounts, share, waitlistCounts } from './dashboard-counts';
import styles from './dashboard.scss';

type Scope = Record<string, string>;

function Bars({
  counts,
  testId,
  figureOf,
}: {
  counts: Array<Count>;
  testId: string;
  figureOf?: (label: string) => Figure;
}) {
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
          <span className={styles.count}>
            <CountLink value={count.value} figure={figureOf?.(count.label)} />
          </span>
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
  figure,
}: {
  label: string;
  value: number | null;
  note: string;
  isLoading: boolean;
  error?: Error;
  figure?: Figure;
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
            <span className={styles.tileValue}>
              {error || value === null ? '–' : <CountLink value={value} figure={figure} />}
            </span>
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

const adherentSteps = ['Adherent (80%+)', 'Adherent'];
// The care cascade counts these from ACT Core's adherence as of its last run, whatever the end date.
const stepsCountedToday = ['Covered today', ...adherentSteps];
const earliestAsOf = '1900-01-01';

function Figures({ scope, asOf, onShowAll }: { scope: Scope; asOf: string; onShowAll: () => void }) {
  const { t } = useTranslation();
  const { careCascade, dashboard } = useConfig<Config>();
  const params = useMemo(() => ({ endDate: asOf, ...scope }), [asOf, scope]);
  const clinics = useClinicNames(scope);
  const clinic = [clinics.cardiac, clinics.primaryCare].filter(Boolean).join(', ') || null;

  const { counted, countParams, pending } = useCountParams(params);
  const whileLimitRead = (report: ReturnType<typeof useReportDataset>) => ({
    ...report,
    isLoading: report.isLoading || pending,
  });
  const registrantsReport = whileLimitRead(useReportDataset(counted ? dashboard.registrantsReport : null, countParams));
  const registrants = useMemo(() => registrantCounts(registrantsReport.rows), [registrantsReport.rows]);

  const cascadeReport = whileLimitRead(useReportDataset(counted ? careCascade.report : null, countParams));
  const isPast = asOf < dayjs().format('YYYY-MM-DD');
  const { cascade, leftOutToday } = useMemo(() => {
    const steps = cascadeSteps(cascadeReport.rows, careCascade.steps);
    const dated = isPast ? steps.filter(({ step }) => !stepsCountedToday.includes(step)) : steps;
    return { cascade: dated, leftOutToday: dated.length < steps.length };
  }, [cascadeReport.rows, careCascade.steps, isPast]);
  // Adherent is a share of Initiated BPG, as the design corrects ACT 2.0, rather than of Covered today.
  const labelOf = (...steps: Array<string>) => cascade.find(({ step }) => steps.includes(step))?.label;
  const adherent = labelOf(...adherentSteps);
  const initiated = labelOf('Initiated', 'Initiated BPG');
  const adherentShare = adherent && initiated ? { [adherent]: initiated } : undefined;

  const waitlistReport = whileLimitRead(useReportDataset(counted ? dashboard.waitlistReport : null, countParams));
  const waitlist = useMemo(() => waitlistCounts(waitlistReport.rows), [waitlistReport.rows]);
  const phone = useLayoutType() === 'phone';
  const [waitlistAsTable, setWaitlistAsTable] = useState(phone);

  const optimisationReport = whileLimitRead(
    useReportDataset(counted ? dashboard.medicalOptimisationReport : null, countParams),
  );
  const screeningReport = useReportDataset(dashboard.screeningCascadeReport, params);
  const diagnosesReport = useReportDataset(dashboard.screeningDiagnosesReport, params);

  const measures = optimisationReport.rows.map((row: ReportRow) => {
    const done = Number(row.done ?? 0);
    const notDone = row.not_done === null || row.not_done === undefined ? null : Number(row.not_done);
    return { measure: String(row.measure), label: measureLabel(t, String(row.measure)), done, notDone };
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
  const prescribedStep = cascadeReport.rows.find((row) =>
    ['Prescribed', 'Prescribed Prophylaxis'].includes(String(row.step)),
  );
  const stepOfLabel = (label: string) => cascade.find((step) => step.label === label)?.step;
  const registrantsBy =
    (breakdown: string) =>
    (label: string): Figure => ({ figure: 'registrants', breakdown, label });

  return (
    <>
      <div className={styles.tiles}>
        <FigureTile
          label={t('registered', 'Registered')}
          value={registrants.registered}
          note={t('everyStatus', 'every status')}
          isLoading={registrantsReport.isLoading}
          error={registrantsReport.error}
          figure={{ figure: 'registrants', breakdown: 'registered' }}
        />
        <FigureTile
          label={t('active', 'Active')}
          value={registrants.active}
          note={t('enrolledAndAlive', 'enrolled and alive')}
          isLoading={registrantsReport.isLoading}
          error={registrantsReport.error}
          figure={{ figure: 'registrants', breakdown: 'active' }}
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
          figure={prescribedStep && { figure: 'cascade', step: String(prescribedStep.step) }}
        />
        <FigureTile
          label={t('waitingForAProcedure', 'Waiting for a procedure')}
          value={waitlist.patients}
          note={t('openRecommendations', '{{count}} open recommendations', { count: waitlist.total })}
          isLoading={waitlistReport.isLoading}
          error={waitlistReport.error}
          figure={{ figure: 'waitlist', breakdown: 'total' }}
        />
      </div>
      <div className={styles.grid}>
        <Section
          title={t('registrantStatus', 'Registrant status')}
          description={t('registrantsByStatus', 'All {{count}} registrants, by where their registration stands', {
            count: registrants.registered,
          })}
          state={stateOf(registrantsReport, !registrants.registered)}
          {...section}
        >
          <CountsDonut
            name={t('registrantStatus', 'Registrant status')}
            counts={registrants.status}
            centre={t('registrants', 'registrants')}
            testId="dashboard-status"
            withShare
            figureOf={registrantsBy('status')}
          />
        </Section>
        <Section
          title={t('rhdCareCascade', 'RHD care cascade')}
          description={
            leftOutToday
              ? t(
                  'careCascadePastDescription',
                  'Active RHD patients; each step is a share of the one before. Coverage and adherence are left out, as ACT Core keeps them only for today.',
                )
              : t(
                  'careCascadeDescription',
                  'Active RHD patients; each step is a share of the one before, Adherent of Initiated',
                )
          }
          state={stateOf(cascadeReport, allZero(cascade))}
          {...section}
        >
          <CascadeBars
            name={t('rhdCareCascade', 'RHD care cascade')}
            steps={cascade}
            shareOf={adherentShare}
            testId="dashboard-cascade-step"
            figureOf={(label) => ({ figure: 'cascade', step: stepOfLabel(label) })}
          />
        </Section>
        <Section
          title={t('activeRegistrantsCount', 'Active registrants: {{count}}', { count: registrants.active })}
          name={t('activeRegistrants', 'Active registrants')}
          description={t('activeRegistrantsDescription', 'Sex, age and disease of the active patients')}
          state={stateOf(registrantsReport, !registrants.active)}
          wide
          {...section}
        >
          <div className={styles.columns}>
            <div>
              <h4 className={styles.subheading}>{t('sex', 'Sex')}</h4>
              <Bars counts={registrants.sex} testId="dashboard-sex" figureOf={registrantsBy('sex')} />
            </div>
            <div>
              <h4 className={styles.subheading}>{t('age', 'Age')}</h4>
              <Bars counts={registrants.age} testId="dashboard-age" figureOf={registrantsBy('age')} />
            </div>
            <div>
              <h4 className={styles.subheading}>{t('diseaseCategory', 'Disease category')}</h4>
              <Bars counts={registrants.category} testId="dashboard-category" figureOf={registrantsBy('disease')} />
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
            "Open recommendations in each active patient's latest consultation, by urgency",
          )}
          state={stateOf(waitlistReport, !waitlist.total && !waitlist.performed.bmv && !waitlist.performed.surgery)}
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
                        <TableCell key={waitlist.urgencies[index]}>
                          <CountLink
                            value={count}
                            figure={
                              count
                                ? {
                                    figure: 'waitlist',
                                    breakdown: 'open',
                                    procedure: row.procedure,
                                    urgency: waitlist.urgencies[index],
                                  }
                                : undefined
                            }
                          />
                        </TableCell>
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
                    <span className={styles.count}>
                      <CountLink
                        value={row.counts.reduce((sum, count) => sum + count, 0)}
                        figure={{ figure: 'waitlist', breakdown: 'open', procedure: row.procedure }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className={styles.performed} data-testid="dashboard-performed">
            <Trans
              t={t}
              i18nKey="performedInYear"
              defaults="Performed in the 12 months to the date shown: mitral balloon valvuloplasty <bmv>{{bmv}}</bmv>, surgery <surgery>{{surgery}}</surgery>"
              values={waitlist.performed}
              components={{
                bmv: (
                  <CountLink
                    value={waitlist.performed.bmv}
                    figure={{ figure: 'waitlist', breakdown: 'performed', procedure: 'Mitral balloon valvuloplasty' }}
                  />
                ),
                surgery: (
                  <CountLink
                    value={waitlist.performed.surgery}
                    figure={{ figure: 'waitlist', breakdown: 'performed', procedure: 'Surgery' }}
                  />
                ),
              }}
            />
          </p>
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
                  {measure.notDone === null ? (
                    <CountLink value={measure.done} figure={{ figure: 'optimisation', measure: measure.measure }} />
                  ) : (
                    <Trans
                      t={t}
                      i18nKey="doneNotDoneOf"
                      defaults="<done>{{done}}</done> done, <notDone>{{notDone}}</notDone> not done, of {{total}}"
                      values={{ done: measure.done, notDone: measure.notDone, total: measure.done + measure.notDone }}
                      components={{
                        done: (
                          <CountLink
                            value={measure.done}
                            figure={{ figure: 'optimisation', measure: measure.measure, outcome: 'done' }}
                          />
                        ),
                        notDone: (
                          <CountLink
                            value={measure.notDone}
                            figure={{ figure: 'optimisation', measure: measure.measure, outcome: 'notDone' }}
                          />
                        ),
                      }}
                    />
                  )}
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

const urlKeys = ['cardiacClinic', 'primaryCareClinic', 'asOf', ...figureKeys] as const;
type UrlKey = (typeof urlKeys)[number];
const noFigure = Object.fromEntries(figureKeys.map((key) => [key, ''])) as Record<(typeof figureKeys)[number], string>;

export default function Dashboard() {
  const { t } = useTranslation();
  const sessionScope = useProgrammeScope(false);
  // Clinics, date and open figure live in the URL, so a list can be shared and Back keeps them.
  const [url, setUrl, pending] = useUrlFilters(
    urlKeys,
    sessionScope.status === 'ready' ? sessionScope.params : sessionScope.status === 'error' ? {} : 'pending',
  );
  // A plain date, as a zoned midnight reads as the day before on a server behind the browser's time zone.
  const today = dayjs().format('YYYY-MM-DD');
  const asOf = url.asOf || today;
  const setAsOf = (day: string) => setUrl({ asOf: day === today ? '' : day });
  const scope = useMemo(
    () =>
      pending
        ? undefined
        : (Object.fromEntries(
            Object.entries({ cardiacClinic: url.cardiacClinic, primaryCareClinic: url.primaryCareClinic }).filter(
              ([, uuid]) => uuid,
            ),
          ) as Scope),
    [pending, url.cardiacClinic, url.primaryCareClinic],
  );
  const setScope = useCallback(
    (next: Scope) =>
      setUrl({ cardiacClinic: next.cardiacClinic ?? '', primaryCareClinic: next.primaryCareClinic ?? '' }),
    [setUrl],
  );
  const figure = sections.includes(url.figure as FigureSection) ? ({ ...url, figure: url.figure } as Figure) : null;
  const defaultedKeys = sessionScope.status === 'ready' ? (Object.keys(sessionScope.params) as Array<UrlKey>) : [];
  const hrefOf = (change: Partial<Record<UrlKey, string>>) =>
    urlWithFilters(urlKeys, { ...url, ...change }, defaultedKeys);
  // Pushed, so the browser's Back undoes opening or leaving a figure; a removed chip only replaces.
  const go = (change: Partial<Record<UrlKey, string>>) => {
    window.history.pushState(window.history.state, '', hrefOf(change));
    setUrl(change);
  };
  const figureLinks = {
    href: (next: Figure) => hrefOf({ ...noFigure, ...next }),
    open: (next: Figure) => go({ ...noFigure, ...next }),
  };
  const clinicNames = useClinicNames(scope ?? {});

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
        ) : figure ? (
          <DashboardFigure
            figure={figure}
            scope={scope}
            asOf={asOf}
            clinicNames={clinicNames}
            onFigure={(next) => setUrl({ ...noFigure, ...next })}
            onScope={setScope}
            onAsOf={setAsOf}
            onBack={() => go(noFigure)}
          />
        ) : (
          <>
            <div className={styles.filters}>
              <ClinicFilters scope={scope} onChange={setScope} idPrefix="dashboard" />
              <OpenmrsDatePicker
                id="dashboard-as-of"
                labelText={t('figuresAsOf', 'Figures as of')}
                value={dayjs(asOf).toDate()}
                minDate={dayjs(earliestAsOf).toDate()}
                maxDate={new Date()}
                onChange={(date) => {
                  const day = date && dayjs(date).format('YYYY-MM-DD');
                  // The picker reports a year at each digit typed, as 0002, 0020 and 0202 on the way to 2026.
                  if (day && day >= earliestAsOf) {
                    setAsOf(day);
                  }
                }}
              />
            </div>
            <FigureLinks.Provider value={figureLinks}>
              <Figures scope={scope} asOf={asOf} onShowAll={() => setScope({})} />
            </FigureLinks.Provider>
          </>
        )}
      </div>
    </div>
  );
}
