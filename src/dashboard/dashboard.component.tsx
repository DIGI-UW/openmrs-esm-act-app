import React, { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { DonutChart, SimpleBarChart, StackedBarChart, ScaleTypes } from '@carbon/charts-react';
import '@carbon/charts-react/styles.css';
import { InlineNotification, Select, SelectItem, SkeletonText } from '@carbon/react';
import { OpenmrsDatePicker, ReportsPictogram, useConfig } from '@openmrs/esm-framework';
import { ActHomeCard } from '../act-home/act-home-card.component';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import { type Config } from '../config-schema';
import { ClinicFilters } from '../programme-report/programme-report.component';
import { useProgrammeScope } from '../programme-report/programme-scope';
import { useReportDataset } from '../reports/report-dataset.resource';
import {
  careCharts,
  type ChartDatum,
  registrantCharts,
  screeningCascadeSteps,
  screeningCharts,
} from './dashboard.resource';
import styles from './dashboard.scss';

const chartOptions = (height: string) => ({
  height,
  toolbar: { enabled: false },
  animations: false,
  legend: { truncation: { type: 'none' as const } },
});

/**
 * A horizontal bar per key, stacked by group, as ACT 2.0's demographics and medical optimisation charts. Given a
 * title, the chart has one series, which the title names in place of a legend.
 */
const horizontal = (height: string, title?: string) => ({
  ...chartOptions(height),
  ...(title && { title, legend: { enabled: false } }),
  axes: {
    left: { mapsTo: 'key', scaleType: ScaleTypes.LABELS, truncation: { type: 'none' as const } },
    bottom: { mapsTo: 'value', stacked: true },
  },
});

/** One bar per key, its series named after the chart. */
const single = (title: string, rows: Array<{ key: string; value: number }>): Array<ChartDatum> =>
  rows.map(({ key, value }) => ({ group: title, key, value }));

function Section({
  title,
  isLoading,
  error,
  children,
}: {
  title: string;
  isLoading: boolean;
  error: unknown;
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
          title={t('couldNotLoadSection', 'Could not load {{section}}', { section: title })}
        />
      ) : isLoading ? (
        <SkeletonText paragraph lineCount={5} />
      ) : (
        children
      )}
    </ActHomeCard>
  );
}

function Figure({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className={styles.figure} role="group" aria-label={label}>
      <span className={styles.figureLabel}>{label}</span>
      <span className={styles.figureValue}>{value}</span>
    </div>
  );
}

function Registrants({ params, ready }: { params: Record<string, string>; ready: boolean }) {
  const { t } = useTranslation();
  const { dashboard } = useConfig<Config>();
  const report = useReportDataset(ready ? dashboard.registrantsReport : null, params);
  const [category, setCategory] = useState('');
  const charts = useMemo(() => registrantCharts(report.rows, category), [report.rows, category]);
  const isLoading = report.isLoading || !ready;
  return (
    <>
      <Section title={t('registrants', 'Registrants')} isLoading={isLoading} error={report.error}>
        <div className={styles.figures}>
          <Figure label={t('total', 'Total')} value={charts.total} />
          <Figure label={t('active', 'Active')} value={charts.active} />
        </div>
        {charts.total ? (
          <DonutChart
            data={charts.status}
            options={{ ...chartOptions('280px'), donut: { center: { label: t('patients', 'Patients') } } }}
          />
        ) : (
          <p className={styles.empty}>{t('noRegistrants', 'No patients are enrolled')}</p>
        )}
      </Section>
      <Section title={t('demographics', 'Demographics')} isLoading={isLoading} error={report.error}>
        <Select
          id="dashboard-demographics-category"
          className={styles.select}
          labelText={t('categoryAtDiagnosis', 'Category at diagnosis')}
          size="sm"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <SelectItem value="" text={t('all', 'All')} />
          {charts.categories.map((name) => (
            <SelectItem key={name} value={name} text={name} />
          ))}
        </Select>
        <p className={styles.note}>{t('activePatientsOnly', 'Active patients')}</p>
        <SimpleBarChart data={single(t('age', 'Age'), charts.age)} options={horizontal('180px', t('age', 'Age'))} />
        <SimpleBarChart data={single(t('sex', 'Sex'), charts.sex)} options={horizontal('140px', t('sex', 'Sex'))} />
        <SimpleBarChart
          data={single(t('disease', 'Disease'), charts.disease)}
          options={horizontal('260px', t('disease', 'Disease'))}
        />
      </Section>
    </>
  );
}

function ScreeningCascade({ params, ready }: { params: Record<string, string>; ready: boolean }) {
  const { t } = useTranslation();
  const { dashboard } = useConfig<Config>();
  const report = useReportDataset(ready ? dashboard.screeningCascadeReport : null, params);
  const labels = {
    'Confirmatory Diagnosis': t('screenedPositive', 'Screened positive'),
    Diagnosed: t('confirmatoryEchoReceived', 'Confirmatory echo received'),
    'Heart Disease': t('heartDisease', 'Heart disease'),
  };
  const steps = screeningCascadeSteps(report.rows);
  return (
    <Section
      title={t('screeningCascade', 'Screening cascade')}
      isLoading={report.isLoading || !ready}
      error={report.error}
    >
      <SimpleBarChart
        data={steps.map(({ step, value }) => ({ group: labels[step], key: labels[step], value }))}
        options={{
          ...chartOptions('260px'),
          axes: {
            left: { mapsTo: 'value' },
            bottom: { mapsTo: 'key', scaleType: ScaleTypes.LABELS, truncation: { type: 'none' as const } },
          },
          legend: { enabled: false },
        }}
      />
      <ul className={styles.shares}>
        {steps
          .filter(({ share }) => share !== null)
          .map(({ step, share }) => (
            <li key={step}>
              {t('shareOfStepBefore', '{{step}}: {{share}}% of the step before', { step: labels[step], share })}
            </li>
          ))}
      </ul>
    </Section>
  );
}

function Care({ params, ready }: { params: Record<string, string>; ready: boolean }) {
  const { t } = useTranslation();
  const { dashboard } = useConfig<Config>();
  const report = useReportDataset(ready ? dashboard.careReport : null, params);
  const charts = useMemo(() => careCharts(report.rows), [report.rows]);
  const isLoading = report.isLoading || !ready;
  return (
    <>
      <Section title={t('proceduralWaitlist', 'Procedural waitlist')} isLoading={isLoading} error={report.error}>
        {charts.waitlistTotal ? (
          <StackedBarChart
            data={charts.waitlist}
            options={{
              ...chartOptions('300px'),
              axes: {
                left: { mapsTo: 'value', stacked: true },
                bottom: { mapsTo: 'key', scaleType: ScaleTypes.LABELS, truncation: { type: 'none' as const } },
              },
            }}
          />
        ) : (
          <p className={styles.empty}>{t('noOneWaiting', 'No one is waiting for a procedure')}</p>
        )}
        <div className={styles.figures}>
          <Figure label={t('bmvPerformed', 'BMV performed')} value={charts.bmvPerformed} />
          <Figure label={t('proceduresPerformed', 'Procedures performed')} value={charts.proceduresPerformed} />
        </div>
      </Section>
      <Section title={t('medicalOptimisation', 'Medical optimisation')} isLoading={isLoading} error={report.error}>
        <StackedBarChart data={charts.optimisation} options={horizontal('260px')} />
        <p className={styles.note}>{t('prescribedWarfarin', 'Patients prescribed warfarin')}</p>
        {charts.inr.length ? (
          <StackedBarChart data={charts.inr} options={horizontal('120px')} />
        ) : (
          <p className={styles.empty}>{t('noOneOnWarfarin', 'No active patient is prescribed warfarin')}</p>
        )}
      </Section>
    </>
  );
}

function Screening({ scope, ready }: { scope: Record<string, string>; ready: boolean }) {
  const { t } = useTranslation();
  const { dashboard } = useConfig<Config>();
  // ACT 2.0's default: the year to today
  const [startDate, setStartDate] = useState<Date>(() => dayjs().subtract(1, 'year').startOf('day').toDate());
  const [endDate, setEndDate] = useState<Date>(() => dayjs().startOf('day').toDate());
  const backwards = dayjs(endDate).isBefore(startDate, 'day');
  // Plain dates, as a zoned midnight reads as the day before on a server behind the browser's time zone.
  const params = useMemo(
    () => ({
      startDate: dayjs(startDate).format('YYYY-MM-DD'),
      endDate: dayjs(endDate).format('YYYY-MM-DD'),
      ...scope,
    }),
    [startDate, endDate, scope],
  );
  const report = useReportDataset(ready && !backwards ? dashboard.screeningReport : null, params);
  const charts = useMemo(() => screeningCharts(report.rows), [report.rows]);
  return (
    <Section title={t('screening', 'Screening')} isLoading={false} error={report.error}>
      <div className={styles.dates}>
        <OpenmrsDatePicker
          id="dashboard-screening-start"
          labelText={t('enrolledFrom', 'Enrolled from')}
          value={startDate}
          onChange={(date) => date && setStartDate(date)}
        />
        <OpenmrsDatePicker
          id="dashboard-screening-end"
          labelText={t('enrolledTo', 'Enrolled to')}
          value={endDate}
          invalid={backwards}
          invalidText={t('endBeforeStart', 'The end is before the start')}
          onChange={(date) => date && setEndDate(date)}
        />
      </div>
      <p className={styles.note}>
        {t(
          'screeningOfRegistrants',
          'Patients enrolled in the registry in the period, as ACT 3.0 does not record monthly screening counts',
        )}
      </p>
      {backwards ? null : report.isLoading || !ready ? (
        <SkeletonText paragraph lineCount={5} />
      ) : (
        <div className={styles.screening}>
          <div className={styles.figures}>
            <Figure label={t('enrolled', 'Enrolled')} value={charts.total} />
            <Figure
              label={t('percentFemale', 'Percent female')}
              value={charts.percentFemale === null ? '–' : `${charts.percentFemale}%`}
            />
          </div>
          <SimpleBarChart
            data={single(t('screenPositiveAnswer', 'Screen +'), charts.screenPositive)}
            options={horizontal('140px', t('screenPositiveAnswer', 'Screen +'))}
          />
          <SimpleBarChart data={single(t('age', 'Age'), charts.age)} options={horizontal('160px', t('age', 'Age'))} />
          {charts.total ? (
            <DonutChart
              data={charts.detectedBy}
              options={{ ...chartOptions('260px'), title: t('caseDetectedBy', 'Case detected by') }}
            />
          ) : null}
        </div>
      )}
    </Section>
  );
}

/** The Dashboard: ACT 2.0's dashboard charts, of the session location's clinic until another is chosen. */
export default function Dashboard() {
  const { t } = useTranslation();
  const sessionScope = useProgrammeScope(false);
  const [chosenScope, setChosenScope] = useState<Record<string, string>>();
  const scope = chosenScope ?? (sessionScope.status === 'ready' ? sessionScope.params : undefined);
  // Send a plain date: the server runs on UTC, so a local-midnight timestamp east of UTC lands on yesterday.
  const today = useMemo(() => dayjs().format('YYYY-MM-DD'), []);
  const params = useMemo(() => ({ endDate: today, ...scope }), [today, scope]);
  const ready = Boolean(scope);

  return (
    <>
      <ActPageHeader title={t('dashboard', 'Dashboard')} illustration={<ReportsPictogram />} />
      <div className={styles.dashboard}>
        {sessionScope.status === 'error' ? (
          <InlineNotification
            kind="error"
            lowContrast
            hideCloseButton
            title={t('couldNotReadSessionClinic', 'Could not read the clinic you are signed in at')}
          />
        ) : (
          scope && (
            <div className={styles.filters}>
              <ClinicFilters scope={scope} onChange={setChosenScope} />
            </div>
          )
        )}
        <div className={styles.grid}>
          <Registrants params={params} ready={ready} />
          <ScreeningCascade params={params} ready={ready} />
          <Care params={params} ready={ready} />
        </div>
        <Screening scope={scope} ready={ready} />
      </div>
    </>
  );
}
