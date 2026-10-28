import React, { useCallback, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Trans, useTranslation } from 'react-i18next';
import {
  Button,
  InlineNotification,
  Layer,
  Select,
  SelectItem,
  SkeletonText,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tag,
  Tile,
} from '@carbon/react';
import { OpenmrsDatePicker, ReportsPictogram, useConfig, useLayoutType, useSession } from '@openmrs/esm-framework';
import { ActHomeCard } from '../act-home/act-home-card.component';
import { cascadeSteps } from '../act-home/care-cascade-steps';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import { type Config } from '../config-schema';
import { useClinicLimit } from '../clinic-limit';
import { useClinics } from '../programme-report/clinics.resource';
import { ClinicFilters } from '../programme-report/programme-report.component';
import { useProgrammeScope } from '../programme-report/programme-scope';
import { type ReportRow, useReportDataset } from '../reports/report-dataset.resource';
import { DownloadCsvButton } from '../table-filters/download-csv-button.component';
import { urlWithFilters, useUrlFilters } from '../table-filters/url-filters';
import { CascadeBars, CountLink, CountsDonut, labelColour, StackedBars } from './dashboard-charts.component';
import { type CountRow, CountsCsv, type CsvPart, countRows, csvParts, useCountsCsv } from './dashboard-csv';
import {
  type Figure,
  FigureLinks,
  figureKeys,
  measureLabel,
  type Section as FigureSection,
  sections,
  useCountParams,
} from './dashboard-figure';
import { RunChartCard } from '../run-charts/run-chart-card.component';
import { DashboardFigure } from './dashboard-figure.component';
import { type Count, registrantCounts, share, shares, waitlistCounts, waitlistName } from './dashboard-counts';
import {
  monthName,
  recentMonths,
  screeningMonthsOffered,
  settings,
  useScreeningLabels,
  useScreeningSummary,
} from '../screening-counts/screening-counts.resource';
import styles from './dashboard.scss';

type Scope = Record<string, string>;

function Bars({
  counts,
  testId,
  figureOf,
  withShares,
  coloured,
}: {
  counts: Array<Count>;
  testId: string;
  figureOf?: (label: string) => Figure;
  /** Prints each count's share of the group too, the shares rounded to add up to 100. */
  withShares?: boolean;
  /** Fills each bar in its label's own colour, as the charts draw it, rather than all in teal. */
  coloured?: boolean;
}) {
  const { t } = useTranslation();
  if (!counts.length) {
    return <p className={styles.empty}>{t('noPatientsToCount', 'No patients to count')}</p>;
  }
  const largest = Math.max(0, ...counts.map((count) => count.value));
  const percents = shares(counts.map((count) => count.value));
  return (
    <div className={styles.bars}>
      {counts.map((count, index) => (
        <div key={count.label} className={withShares ? styles.shareBar : styles.bar} data-testid={testId}>
          <span>{count.label}</span>
          <span className={styles.track}>
            <span
              className={styles.fill}
              data-testid="dashboard-bar-fill"
              style={{
                width: `${share(count.value, largest)}%`,
                ...(coloured && labelColour(count.label) && { backgroundColor: labelColour(count.label) }),
              }}
            />
          </span>
          <span className={styles.count}>
            <CountLink
              value={withShares ? count.value.toLocaleString() : count.value}
              figure={figureOf?.(count.label)}
            />
          </span>
          {withShares && <span className={styles.share}>{percents[index]}%</span>}
        </div>
      ))}
    </div>
  );
}

/**
 * Counts in an order of their own, such as age bands, as columns: each with its count, a link to its patients, and its
 * share of the whole above it, so the chart needs no list beside it.
 */
function Columns({
  name,
  counts,
  testId,
  figureOf,
}: {
  name: string;
  counts: Array<Count>;
  testId: string;
  figureOf?: (label: string) => Figure;
}) {
  const { t } = useTranslation();
  if (!counts.length) {
    return <p className={styles.empty}>{t('noPatientsToCount', 'No patients to count')}</p>;
  }
  const largest = Math.max(0, ...counts.map((count) => count.value));
  const percents = shares(counts.map((count) => count.value));
  return (
    <ol className={styles.columnChart} aria-label={name}>
      {counts.map((count, index) => (
        <li key={count.label} className={styles.column} data-testid={testId}>
          <span className={styles.count}>
            <CountLink value={count.value} figure={figureOf?.(count.label)} />
          </span>
          <span className={styles.share}>{percents[index]}%</span>
          <span className={styles.columnTrack} aria-hidden="true">
            <span className={styles.columnFill} style={{ height: `${share(count.value, largest)}%` }} />
          </span>
          <span className={styles.columnLabel}>{count.label}</span>
        </li>
      ))}
    </ol>
  );
}

const collapsedKey = 'act.dashboard.collapsed';

/**
 * Which sections a viewer has collapsed, kept in this browser so the Dashboard opens as they left it. A browser that
 * keeps nothing opens every section.
 */
function useCollapsedSections() {
  const [collapsed, setCollapsed] = useState<Array<string>>(() => {
    try {
      const kept = JSON.parse(window.localStorage.getItem(collapsedKey) ?? '[]');
      return Array.isArray(kept) ? kept : [];
    } catch {
      return [];
    }
  });
  const toggle = useCallback((id: string) => {
    setCollapsed((current) => {
      const next = current.includes(id) ? current.filter((one) => one !== id) : [...current, id];
      try {
        window.localStorage.setItem(collapsedKey, JSON.stringify(next));
      } catch {
        // Not kept, as in a private window; the section still collapses until the page is left.
      }
      return next;
    });
  }, []);
  return (id: string) => ({ collapsed: collapsed.includes(id), onToggle: () => toggle(id) });
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
  tag,
  controls,
  emptyText,
  embedded,
  collapse,
  children,
}: {
  title: string;
  tag?: React.ReactNode;
  /** What its error calls it, where the title carries a count. */
  name?: string;
  description?: string;
  state: SectionState;
  clinic: string | null;
  onShowAll: () => void;
  wide?: boolean;
  /** Shown whatever the state, so a period that counts nobody can still be changed. */
  controls?: React.ReactNode;
  /** What an empty section says, where it counts something other than patients. */
  emptyText?: string;
  /** Drawn inside a tab of another card, which names it, so without its own card and title. */
  embedded?: boolean;
  /** Whether the section is collapsed to its title, and how it is toggled. */
  collapse?: { collapsed: boolean; onToggle: () => void };
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  const body = (
    <>
      {description && <p className={styles.description}>{description}</p>}
      {controls}
      {state.error ? (
        <div className={styles.state}>
          <InlineNotification
            kind="error"
            statusIconDescription={t('errorIcon', 'error icon')}
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
            {emptyText ??
              (clinic
                ? t('nobodyAtClinicToCount', 'Nobody at {{clinic}} to count', { clinic })
                : t('noPatientsToCount', 'No patients to count'))}
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
    </>
  );
  return embedded ? (
    <div className={styles.embedded}>{body}</div>
  ) : (
    <div className={wide ? styles.wide : undefined}>
      <ActHomeCard title={title} tag={tag} {...collapse}>
        {body}
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
    <div className={styles.figureTile} data-testid="dashboard-tile">
      <span className={styles.figureValue}>
        {isLoading ? (
          <SkeletonText heading width="3rem" />
        ) : error || value === null ? (
          '–'
        ) : (
          <CountLink value={value} figure={figure} />
        )}
      </span>
      <span className={styles.figureText}>
        <span className={styles.figureLabel}>{label}</span>
        {!isLoading && (
          <span className={styles.tileNote}>
            {error ? t('couldNotLoad', 'could not load') : value === null ? t('notReported', 'not reported') : note}
          </span>
        )}
      </span>
    </div>
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

/** An urgency's leading number, as a phone's narrow table heads it, unless another urgency starts with the same one. */
const urgencyHeader = (urgency: string, urgencies: Array<string>) => {
  const number = parseInt(urgency, 10);
  return Number.isNaN(number) || urgencies.filter((other) => parseInt(other, 10) === number).length > 1
    ? urgency
    : String(number);
};

const adherentSteps = ['Adherent (80%+)', 'Adherent'];
// The care cascade counts these from ACT Core's adherence as of its last run, whatever the end date.
const stepsCountedToday = ['Covered today', ...adherentSteps];
const earliestAsOf = '1900-01-01';
// The design's order; a measure it does not name, such as consultations, comes last.
const measureOrder = ['retainedInCare', 'echocardiogram', 'interventionAssigned', 'interventions', 'warfarin'];

function Figures({ scope, asOf, onShowAll }: { scope: Scope; asOf: string; onShowAll: () => void }) {
  const { t } = useTranslation();
  const { careCascade, dashboard } = useConfig<Config>();
  const params = useMemo(() => ({ endDate: asOf, ...scope }), [asOf, scope]);
  const clinics = useClinicNames(scope);
  const clinic = [clinics.cardiac, clinics.primaryCare].filter(Boolean).join(', ') || null;

  const { counted, countParams, pending } = useCountParams(params);
  const collapsible = useCollapsedSections();
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
  const screeningReport = useReportDataset(dashboard.showScreening ? dashboard.screeningCascadeReport : null, params);
  const diagnosesReport = useReportDataset(dashboard.showScreening ? dashboard.screeningDiagnosesReport : null, params);

  const measures = optimisationReport.rows
    .map((row: ReportRow) => {
      const done = Number(row.done ?? 0);
      const notDone = row.not_done === null || row.not_done === undefined ? null : Number(row.not_done);
      return { measure: String(row.measure), label: measureLabel(t, String(row.measure)), done, notDone };
    })
    .sort((a, b) => (measureOrder.indexOf(a.measure) + 1 || 99) - (measureOrder.indexOf(b.measure) + 1 || 99));

  // The report's first step is active RHD, which is not part of screening; the rest are named as the design reads them.
  const screeningStepNames: Record<string, string> = {
    'Confirmatory Diagnosis': t('screenedPositive', 'Screened positive'),
    Diagnosed: t('hadConfirmatoryEcho', 'Had a confirmatory echo'),
    'Heart Disease': t('heartDisease', 'Heart disease'),
  };
  const screening = screeningReport.rows
    .filter((row) => row.step !== 'Active')
    .map((row) => ({
      label: screeningStepNames[String(row.step)] ?? String(row.step),
      value: Number(row.patients ?? 0),
    }));
  const diagnosisNames: Record<string, string> = {
    'Rheumatic Heart Disease/Rheumatic Fever': t('rhd', 'RHD'),
    'Congenital heart disease': t('congenital', 'Congenital'),
    'Other heart disease': t('other', 'Other'),
  };
  const byBreakdown = (breakdown: string, column: string) =>
    diagnosesReport.rows
      .filter((row) => row.breakdown === breakdown)
      .map((row) => ({ label: String(row[column] ?? t('none', 'None')), value: Number(row.patients ?? 0) }));
  const diagnoses = byBreakdown('category', 'category').map((count) => ({
    ...count,
    label: diagnosisNames[count.label] ?? count.label,
  }));
  const rhdDetails = byBreakdown('rhdDetails', 'details');
  const screenDetectedRhd = rhdDetails.reduce((sum, count) => sum + count.value, 0);

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

  // A section that could not load gives no rows, so the file never shows its zeros as counts.
  const keyFigures = t('keyFigures', 'Key figures');
  const loaded = (report: { error?: Error }, rows: () => Array<CountRow>) => (report.error ? [] : rows());
  const waitlistSection = t('proceduralWaitlist', 'Procedural waitlist');
  const activeName = t('activeRegistrants', 'Active registrants');
  const csvRows: Array<CountRow> = [
    ...loaded(registrantsReport, () =>
      countRows(
        keyFigures,
        '',
        [
          { label: t('registered', 'Registered'), value: registrants.registered },
          { label: t('active', 'Active'), value: registrants.active },
        ],
        asOf,
      ),
    ),
    ...loaded(cascadeReport, () =>
      prescribed === null
        ? []
        : countRows(
            keyFigures,
            '',
            [{ label: t('onSecondaryProphylaxis', 'On secondary prophylaxis'), value: prescribed }],
            asOf,
          ),
    ),
    ...loaded(waitlistReport, () =>
      countRows(
        keyFigures,
        '',
        [
          { label: t('waitingForAProcedure', 'Waiting for a procedure'), value: waitlist.patients },
          { label: t('openRecommendationsFigure', 'Open recommendations'), value: waitlist.total },
        ],
        asOf,
      ),
    ),
    ...loaded(registrantsReport, () =>
      countRows(t('registrantStatus', 'Registrant status'), '', registrants.status, asOf),
    ),
    ...loaded(cascadeReport, () =>
      countRows(
        t('rhdCareCascade', 'RHD care cascade'),
        '',
        cascade.map(({ label, value }) => ({ label: t(label), value })),
        asOf,
      ),
    ),
    ...loaded(registrantsReport, () => [
      ...countRows(activeName, t('sex', 'Sex'), registrants.sex, asOf),
      ...countRows(activeName, t('age', 'Age'), registrants.age, asOf),
      ...countRows(activeName, t('disease', 'Disease'), registrants.category, asOf),
    ]),
    ...loaded(waitlistReport, () => [
      ...waitlist.rows.flatMap((row) =>
        countRows(
          waitlistSection,
          waitlistName(t, row.procedure),
          row.counts.map((value, index) => ({ label: waitlistName(t, waitlist.urgencies[index]), value })),
          asOf,
        ),
      ),
      ...countRows(
        waitlistSection,
        t('performedLast12Months', 'Performed in the last 12 months'),
        [
          { label: t('mitralBalloonValvuloplasty', 'Mitral balloon valvuloplasty'), value: waitlist.performed.bmv },
          { label: t('surgery', 'Surgery'), value: waitlist.performed.surgery },
        ],
        asOf,
      ),
    ]),
    ...loaded(optimisationReport, () =>
      measures.flatMap((measure) =>
        countRows(
          t('medicalOptimisation', 'Medical optimisation'),
          measure.label,
          measure.notDone === null
            ? [{ label: '', value: measure.done }]
            : [
                { label: t('done', 'Done'), value: measure.done },
                { label: t('notDone', 'Not done'), value: measure.notDone },
              ],
          asOf,
        ),
      ),
    ),
    ...(dashboard.showScreening && !screeningReport.error && !diagnosesReport.error
      ? [
          ...countRows(t('screeningCascade', 'Screening cascade'), t('cascade', 'Cascade'), screening, asOf),
          ...countRows(
            t('screeningCascade', 'Screening cascade'),
            t('diagnosesAfterTheEcho', 'Diagnoses after the echo'),
            diagnoses,
            asOf,
          ),
          ...countRows(t('screeningCascade', 'Screening cascade'), t('rhdDetails', 'RHD details'), rhdDetails, asOf),
        ]
      : []),
  ];
  useCountsCsv(
    'figures',
    csvRows,
    [registrantsReport, cascadeReport, waitlistReport, optimisationReport].some((report) => report.isLoading) ||
      screeningReport.isLoading ||
      diagnosesReport.isLoading,
  );

  return (
    <>
      <div className={styles.figures}>
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
          collapse={collapsible('status')}
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
          collapse={collapsible('cascade')}
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
          description={t('activeRegistrantsDescription', 'Sex, age and disease of the patients active today')}
          state={stateOf(registrantsReport, !registrants.active)}
          wide
          collapse={collapsible('active')}
          {...section}
        >
          <div className={styles.columns}>
            <div>
              <h4 className={styles.subheading}>{t('sex', 'Sex')}</h4>
              <CountsDonut
                name={t('sex', 'Sex')}
                counts={registrants.sex}
                centre={t('activeCentre', 'active')}
                testId="dashboard-sex"
                withShare
                figureOf={registrantsBy('sex')}
              />
            </div>
            <div>
              <h4 className={styles.subheading}>{t('age', 'Age')}</h4>
              <Columns
                name={t('age', 'Age')}
                counts={registrants.age}
                testId="dashboard-age"
                figureOf={registrantsBy('age')}
              />
            </div>
            <div>
              <h4 className={styles.subheading}>{t('disease', 'Disease')}</h4>
              <Bars
                counts={registrants.category}
                testId="dashboard-category"
                figureOf={registrantsBy('disease')}
                coloured
              />
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
          wide
          collapse={collapsible('waitlist')}
          {...section}
        >
          {waitlistAsTable ? (
            <div className={styles.tableContainer}>
              <Table size="sm" aria-label={t('proceduralWaitlist', 'Procedural waitlist')}>
                <TableHead>
                  <TableRow>
                    <TableHeader>{t('procedure', 'Procedure')}</TableHeader>
                    {waitlist.urgencies.map((urgency) => (
                      <TableHeader key={urgency}>
                        {phone ? urgencyHeader(urgency, waitlist.urgencies) : waitlistName(t, urgency)}
                      </TableHeader>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {waitlist.rows.map((row) => (
                    <TableRow key={row.procedure} data-testid="dashboard-waitlist-row">
                      <TableCell>{waitlistName(t, row.procedure)}</TableCell>
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
              {phone &&
                waitlist.urgencies.some((urgency) => urgencyHeader(urgency, waitlist.urgencies) !== urgency) && (
                  <p className={styles.performed}>
                    {waitlist.urgencies.map((urgency) => waitlistName(t, urgency)).join(', ')}
                  </p>
                )}
            </div>
          ) : (
            <div className={styles.split}>
              <StackedBars
                name={t('proceduralWaitlist', 'Procedural waitlist')}
                data={waitlist.urgencies.flatMap((urgency, index) =>
                  waitlist.rows
                    .filter((row) => row.counts[index])
                    .map((row) => ({
                      group: waitlistName(t, urgency),
                      key: waitlistName(t, row.procedure),
                      value: row.counts[index],
                    })),
                )}
                groups={waitlist.urgencies.map((urgency) => waitlistName(t, urgency))}
                colours="urgency"
                height="14rem"
              />
              <ul className={styles.totals}>
                {waitlist.rows.map((row) => (
                  <li key={row.procedure} className={styles.legendRow} data-testid="dashboard-waitlist-total">
                    <span>{waitlistName(t, row.procedure)}</span>
                    <span className={styles.count}>
                      <CountLink
                        value={row.counts.reduce((sum, count) => sum + count, 0)}
                        figure={{ figure: 'waitlist', breakdown: 'open', procedure: row.procedure }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
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
          description={t(
            'medicalOptimisationDescription',
            'Of the {{count}} active registrants, unless a row says otherwise',
            { count: registrants.active },
          )}
          state={stateOf(
            optimisationReport,
            measures.every((measure) => !measure.done && !measure.notDone),
          )}
          wide
          collapse={collapsible('optimisation')}
          {...section}
        >
          <div className={styles.split}>
            <StackedBars
              name={t('medicalOptimisation', 'Medical optimisation')}
              // Carbon draws a horizontal chart's first key at the bottom, so the list's first row goes last.
              data={measures
                .filter((measure) => measure.notDone !== null)
                .reverse()
                .flatMap((measure) => [
                  { group: t('done', 'Done'), key: measure.label, value: measure.done },
                  { group: t('notDone', 'Not done'), key: measure.label, value: measure.notDone },
                ])}
              groups={[t('done', 'Done'), t('notDone', 'Not done')]}
              colours="doneNotDone"
              height="14rem"
              horizontal
              asShares
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
          </div>
        </Section>
        {dashboard.showScreening && (
          <div className={styles.wide}>
            <ActHomeCard
              {...collapsible('screening')}
              title={t('screening', 'Screening')}
              tag={
                <Tag type="cool-gray" size="sm">
                  {t('screeningProgrammeSites', 'Screening programme sites')}
                </Tag>
              }
            >
              <Tabs>
                <TabList aria-label={t('screening', 'Screening')}>
                  <Tab>{t('screeningCascade', 'Screening cascade')}</Tab>
                  <Tab>{t('rhdScreening', 'RHD screening')}</Tab>
                  <Tab>{t('screeningFromRegistrations', 'Screening, from registrations')}</Tab>
                </TabList>
                <TabPanels>
                  <TabPanel>
                    <Section
                      title={t('screeningCascade', 'Screening cascade')}
                      description={t(
                        'screeningCascadeDescription',
                        'Registrants found by screening (Screen + Yes), and what their confirmatory echo showed',
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
                      embedded
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
                          <h4 className={styles.subheading}>
                            {t('diagnosesAfterTheEcho', 'Diagnoses after the echo')}
                          </h4>
                          <CountsDonut
                            name={t('diagnosesAfterTheEcho', 'Diagnoses after the echo')}
                            counts={diagnoses}
                            centre={t('diagnosed', 'diagnosed')}
                            testId="dashboard-screening-category"
                          />
                        </div>
                        <div>
                          <h4 className={styles.subheading}>
                            {t('screenDetectedRhd', 'RHD details of the {{count}}', { count: screenDetectedRhd })}
                          </h4>
                          <Bars counts={rhdDetails} testId="dashboard-screening-details" coloured />
                        </div>
                      </div>
                    </Section>
                  </TabPanel>
                  <TabPanel>
                    <RhdScreening scope={scope} {...section} />
                  </TabPanel>
                  <TabPanel>
                    <ScreeningFromRegistrations scope={scope} asOf={asOf} {...section} />
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </ActHomeCard>
          </div>
        )}
        <div className={styles.wide}>
          <RunChartCard scope={scope} />
        </div>
      </div>
    </>
  );
}

const screenOrder = ['Yes', 'No', 'Not recorded'];
const registrationAgeOrder = ['Children 0-9', 'Adolescents 10-19', 'Adults 20+', 'Age unknown'];
const detectionOrder = ['School', 'Community', 'Health facility', 'Other', 'Not recorded'];

/** The rows of a breakdown in the order given, a label the order does not name last. */
const inOrder = (rows: Array<ReportRow>, breakdown: string, order: Array<string>): Array<Count> =>
  rows
    .filter((row) => row.breakdown === breakdown)
    .map((row) => ({ label: String(row.label), value: Number(row.patients ?? 0) }))
    .sort((a, b) => (order.indexOf(a.label) + 1 || 99) - (order.indexOf(b.label) + 1 || 99));

/** The screening figures the registry can give from its registrations, for a registration period. */
function ScreeningFromRegistrations({
  scope,
  asOf,
  clinic,
  onShowAll,
}: {
  scope: Scope;
  asOf: string;
  clinic: string | null;
  onShowAll: () => void;
}) {
  const { t } = useTranslation();
  const { dashboard } = useConfig<Config>();
  const [chosen, setChosen] = useState<{ start?: string; end?: string }>({});
  const end = chosen.end ?? asOf;
  const start =
    chosen.start && chosen.start <= end ? chosen.start : dayjs(end).subtract(364, 'day').format('YYYY-MM-DD');
  const params = useMemo(() => ({ startDate: start, endDate: end, ...scope }), [start, end, scope]);
  const { counted, countParams, pending } = useCountParams(params);
  const report = useReportDataset(counted ? dashboard.screeningReport : null, countParams);
  const { rows } = report;
  const registered = Number(rows.find((row) => row.breakdown === 'total')?.patients ?? 0);
  const female = Number(rows.find((row) => row.breakdown === 'female')?.patients ?? 0);
  const pickDate = (key: 'start' | 'end') => (date: Date) => {
    const day = date && dayjs(date).format('YYYY-MM-DD');
    if (day && day >= earliestAsOf) {
      setChosen((current) => ({ ...current, [key]: day }));
    }
  };
  const section = t('screeningFromRegistrations', 'Screening, from registrations');
  const period = t('periodRange', '{{start}} to {{end}}', { start, end });
  useCountsCsv(
    'registrations',
    report.error
      ? []
      : [
          ...countRows(
            section,
            '',
            [
              { label: t('registered', 'Registered'), value: registered },
              { label: t('female', 'Female'), value: female },
            ],
            period,
          ),
          ...countRows(section, t('screenPlus', 'Screen +'), inOrder(rows, 'screen', screenOrder), period),
          ...countRows(
            section,
            t('ageAtRegistration', 'Age at registration'),
            inOrder(rows, 'age', registrationAgeOrder),
            period,
          ),
          ...countRows(
            section,
            t('caseDetectedBy', 'Case detected by'),
            inOrder(rows, 'detected', detectionOrder),
            period,
          ),
        ],
    report.isLoading || pending,
  );

  return (
    <Section
      title={t('screeningFromRegistrations', 'Screening, from registrations')}
      description={t(
        'screeningFromRegistrationsDescription',
        'Patients registered in the period: what the registry itself can say about screening',
      )}
      state={{ ...stateOf(report, !registered), isLoading: report.isLoading || pending }}
      clinic={clinic}
      onShowAll={onShowAll}
      embedded
      controls={
        <div className={styles.registrationControls}>
          <InlineNotification
            kind="info"
            statusIconDescription={t('infoIcon', 'info icon')}
            lowContrast
            hideCloseButton
            title={t(
              'registrationsNotScreening',
              'Counts registered patients, not people screened: a screen-negative child is never registered.',
            )}
          />
          <div className={styles.filters}>
            <OpenmrsDatePicker
              id="dashboard-registered-from"
              labelText={t('registeredFrom', 'Registered from')}
              value={dayjs(start).toDate()}
              minDate={dayjs(earliestAsOf).toDate()}
              maxDate={dayjs(end).toDate()}
              onChange={pickDate('start')}
            />
            <OpenmrsDatePicker
              id="dashboard-registered-to"
              labelText={t('registeredTo', 'Registered to')}
              value={dayjs(end).toDate()}
              minDate={dayjs(start).toDate()}
              maxDate={new Date()}
              onChange={pickDate('end')}
            />
          </div>
        </div>
      }
    >
      <div className={styles.columns}>
        <div className={styles.registrationTiles}>
          <div className={styles.registrationPair}>
            <Tile className={styles.tile} data-testid="dashboard-registration-tile">
              <span className={styles.tileLabel}>{t('registered', 'Registered')}</span>
              <span className={styles.tileValue}>{registered}</span>
            </Tile>
            <Tile className={styles.tile} data-testid="dashboard-registration-tile">
              <span className={styles.tileLabel}>{t('female', 'Female')}</span>
              <span className={styles.tileValue}>{share(female, registered)}%</span>
            </Tile>
          </div>
          <div>
            <h4 className={styles.subheading}>{t('screenPlus', 'Screen +')}</h4>
            <Bars counts={inOrder(rows, 'screen', screenOrder)} testId="dashboard-screen-positive" />
          </div>
        </div>
        <div>
          <h4 className={styles.subheading}>{t('ageAtRegistration', 'Age at registration')}</h4>
          <Bars counts={inOrder(rows, 'age', registrationAgeOrder)} testId="dashboard-registration-age" />
        </div>
        <div>
          <h4 className={styles.subheading}>{t('caseDetectedBy', 'Case detected by')}</h4>
          <CountsDonut
            name={t('caseDetectedBy', 'Case detected by')}
            counts={inOrder(rows, 'detected', detectionOrder)}
            centre={t('registeredCentre', 'registered')}
            testId="dashboard-detected"
          />
        </div>
      </div>
    </Section>
  );
}

/** ACT 2.0's RHD screening section: the monthly counts the clinics enter on the Screening counts page, for a period. */
function RhdScreening({ scope, clinic, onShowAll }: { scope: Scope; clinic: string | null; onShowAll: () => void }) {
  const { t } = useTranslation();
  const months = useMemo(() => recentMonths(screeningMonthsOffered), []);
  const { settingLabel, metricLabel } = useScreeningLabels();
  const [chosen, setChosen] = useState<{ start?: string; end?: string }>({});
  // The twelve months to the last one ended, as a clinic enters a month once it has ended.
  const end = chosen.end ?? months[1];
  // Never before the months the From list offers, so the list shows the month counted from.
  const yearToEnd = dayjs(`${end}-01`).subtract(11, 'month').format('YYYY-MM');
  const oldest = months[months.length - 1];
  const start = chosen.start && chosen.start <= end ? chosen.start : yearToEnd < oldest ? oldest : yearToEnd;
  // ACT Core holds a site administrator to their clinics; with none, ask nothing.
  const limit = useClinicLimit();
  const counted = limit.status === 'none' || (limit.status === 'ready' && limit.uuids.length > 0);
  const pending = limit.status === 'pending';
  const params = useMemo(
    () => (counted ? { clinics: Object.values(scope), startMonth: start, endMonth: end } : null),
    [counted, scope, start, end],
  );
  const { summary, error, isLoading, mutate } = useScreeningSummary(params);
  const screened = summary?.screened ?? 0;
  const monthSelect = (id: string, label: string, value: string, key: 'start' | 'end', options: Array<string>) => (
    <Select
      id={id}
      labelText={label}
      value={value}
      onChange={(event) => setChosen((current) => ({ ...current, [key]: event.target.value }))}
    >
      {options.map((option) => (
        <SelectItem key={option} value={option} text={monthName(option)} />
      ))}
    </Select>
  );

  // ACT Core adds the two clinics' months together.
  const together = t('clinicsAddedTogether', '{{clinics}} added together', { clinics: clinic });
  const counting =
    (Object.keys(scope).length > 1 ? together : clinic) ??
    (limit.status === 'ready'
      ? limit.names.join(', ') || t('yourClinics', 'your clinics')
      : t('everyClinic', 'every clinic'));
  const section = t('rhdScreening', 'RHD screening');
  const period = t('periodRange', '{{start}} to {{end}}', { start, end });
  useCountsCsv(
    'rhdScreening',
    error || !summary
      ? []
      : [
          ...countRows(
            section,
            '',
            [
              { label: metricLabel.screened, value: screened },
              { label: metricLabel.females, value: summary.females ?? 0 },
              { label: metricLabel.positive, value: summary.positive ?? 0 },
            ],
            period,
          ),
          ...countRows(
            section,
            t('result', 'Result'),
            [
              { label: t('negative', 'Negative'), value: summary.negative ?? 0 },
              { label: metricLabel.positive, value: summary.positive ?? 0 },
            ],
            period,
          ),
          ...countRows(
            section,
            t('age', 'Age'),
            [
              { label: metricLabel.children, value: summary.children ?? 0 },
              { label: metricLabel.adolescents, value: summary.adolescents ?? 0 },
              { label: metricLabel.adults, value: summary.adults ?? 0 },
            ],
            period,
          ),
          ...countRows(
            section,
            t('setting', 'Setting'),
            settings.map((setting) => ({ label: settingLabel[setting], value: summary.settings?.[setting] ?? 0 })),
            period,
          ),
        ],
    isLoading || pending,
  );

  return (
    <Section
      title={t('rhdScreening', 'RHD screening')}
      description={t('rhdScreeningDescription', 'Monthly counts, {{clinic}}, {{start}} to {{end}}', {
        clinic: counting,
        start: monthName(start),
        end: monthName(end),
      })}
      state={{
        isLoading: isLoading || pending,
        error,
        retry: () => void mutate(),
        isEmpty: !summary?.months,
      }}
      clinic={clinic}
      onShowAll={onShowAll}
      embedded
      emptyText={
        clinic
          ? t('noScreeningCountsAt', 'No screening counts entered for {{clinic}} in the period', { clinic })
          : t('noScreeningCounts', 'No screening counts entered in the period')
      }
      wide
      controls={
        <div className={styles.filters}>
          {monthSelect(
            'dashboard-screening-from',
            t('fromMonth', 'From'),
            start,
            'start',
            months.filter((month) => month <= end),
          )}
          {monthSelect('dashboard-screening-to', t('toMonth', 'To'), end, 'end', months)}
        </div>
      }
    >
      <div className={styles.screeningTiles}>
        <Tile className={styles.tile} data-testid="dashboard-screening-tile">
          <span className={styles.tileLabel}>{metricLabel.screened}</span>
          <span className={styles.tileValue}>{screened.toLocaleString()}</span>
        </Tile>
        <Tile className={styles.tile} data-testid="dashboard-screening-tile">
          <span className={styles.tileLabel}>{metricLabel.females}</span>
          <span className={styles.tileValue}>{share(summary?.females ?? 0, screened)}%</span>
        </Tile>
        <Tile className={styles.tile} data-testid="dashboard-screening-tile">
          <span className={styles.tileLabel}>{metricLabel.positive}</span>
          <span className={styles.tileValue}>{(summary?.positive ?? 0).toLocaleString()}</span>
        </Tile>
      </div>
      <div className={styles.columns}>
        <div>
          <h4 className={styles.subheading}>{t('result', 'Result')}</h4>
          <Bars
            withShares
            counts={[
              { label: t('negative', 'Negative'), value: summary?.negative ?? 0 },
              { label: metricLabel.positive, value: summary?.positive ?? 0 },
            ]}
            testId="dashboard-screening-result"
          />
        </div>
        <div>
          <h4 className={styles.subheading}>{t('age', 'Age')}</h4>
          <Bars
            withShares
            counts={[
              { label: metricLabel.children, value: summary?.children ?? 0 },
              { label: metricLabel.adolescents, value: summary?.adolescents ?? 0 },
              { label: metricLabel.adults, value: summary?.adults ?? 0 },
            ]}
            testId="dashboard-screening-age"
          />
        </div>
        <div>
          <h4 className={styles.subheading}>{t('setting', 'Setting')}</h4>
          <Bars
            withShares
            counts={settings.map((setting) => ({
              label: settingLabel[setting],
              value: summary?.settings?.[setting] ?? 0,
            }))}
            testId="dashboard-screening-setting"
          />
        </div>
      </div>
      <p className={styles.note}>{t('sharesAddUpTo100', 'Shares are rounded so each group adds up to 100%.')}</p>
    </Section>
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
  const figure = sections.includes(url.figure as FigureSection)
    ? (Object.fromEntries(figureKeys.map((key) => [key, url[key]])) as Figure)
    : null;
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
  const [csv, setCsv] = useState<Partial<Record<CsvPart, { rows: Array<CountRow>; isLoading: boolean }>>>({});
  const putCsv = useCallback(
    (part: CsvPart, rows: Array<CountRow>, isLoading: boolean) =>
      setCsv((current) => ({ ...current, [part]: { rows, isLoading } })),
    [],
  );
  const csvRows = csvParts.flatMap((part) => csv[part]?.rows ?? []);
  // As RHD screening names what it counts: a site administrator's own clinics when no clinic is chosen.
  const limit = useClinicLimit();
  const clinicsCounted =
    [clinicNames.cardiac, clinicNames.primaryCare].filter(Boolean).join(', ') ||
    (limit.status === 'ready'
      ? limit.names.join(', ') || t('yourClinics', 'your clinics')
      : t('everyClinic', 'every clinic'));

  return (
    <div className={styles.page}>
      <ActPageHeader title={t('dashboard', 'Dashboard')} illustration={<ReportsPictogram />} />
      <div className={styles.content}>
        {sessionScope.status === 'error' ? (
          <InlineNotification
            kind="error"
            statusIconDescription={t('errorIcon', 'error icon')}
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
            <div className={`${styles.filters} ${styles.toolbar}`}>
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
              <div className={styles.download}>
                <DownloadCsvButton
                  name="dashboard-counts"
                  list="dashboard:counts"
                  identifiers={false}
                  filters={{ endDate: asOf, ...scope }}
                  headers={[
                    t('csvSection', 'Section'),
                    t('csvGroup', 'Group'),
                    t('csvLabel', 'Label'),
                    t('csvCount', 'Count'),
                    t('period', 'Period'),
                    t('csvClinics', 'Clinics'),
                  ]}
                  rows={() =>
                    csvRows.map((row) => [
                      row.section,
                      row.group,
                      row.label,
                      String(row.count),
                      row.period,
                      clinicsCounted,
                    ])
                  }
                  disabled={!csvRows.length || csvParts.some((part) => csv[part]?.isLoading)}
                  size="md"
                />
              </div>
            </div>
            <FigureLinks.Provider value={figureLinks}>
              <CountsCsv.Provider value={putCsv}>
                <Figures scope={scope} asOf={asOf} onShowAll={() => setScope({})} />
              </CountsCsv.Provider>
            </FigureLinks.Provider>
          </>
        )}
      </div>
    </div>
  );
}
