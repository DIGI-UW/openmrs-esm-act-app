import React, { useMemo } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { Button, ContentSwitcher, InlineNotification, Select, SelectItem, SkeletonText, Switch } from '@carbon/react';
import { ConfigurableLink, formatDate, OpenmrsDatePicker, ReportsPictogram, useConfig } from '@openmrs/esm-framework';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import { useClinicLimit } from '../clinic-limit';
import { type Config } from '../config-schema';
import { useClinics } from '../programme-report/clinics.resource';
import { useUrlFilters } from '../table-filters/url-filters';
import {
  defaultMetric,
  defaultPeriod,
  isMetric,
  isPeriod,
  kindOf,
  metricLabel,
  periodName,
  periodNames,
  type RunChartPeriod,
  runChartMetrics,
} from './run-chart-metrics';
import { changeOf, localDay, MIN_POINTS_FOR_CHART, MIN_POINTS_FOR_MEDIAN, shifts, withValue } from './run-chart-stats';
import { pointDetail } from './run-chart-tooltip';
import { useClinicName } from './run-chart-clinic-name';
import { HistoryNotice } from './run-chart-history-notice.component';
import { RunChartLine } from './run-chart-line.component';
import { type RunChartParams, useRunChart } from './run-chart.resource';
import styles from './run-charts.scss';

const filterKeys = ['metric', 'clinic', 'from', 'to', 'points'] as const;
const isoDay = (date: Date | string) => dayjs(date).format('YYYY-MM-DD');
const validDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && dayjs(value).isValid();

function MetricTile({
  id,
  params,
  current,
  hrefFor,
  onOpen,
}: {
  id: string;
  params: RunChartParams | null;
  current: boolean;
  hrefFor: (metric: string) => string;
  onOpen: (metric: string) => void;
}) {
  const { t } = useTranslation();
  const kind = kindOf(id);
  const chart = useRunChart(params && { ...params, metric: id });
  const held = withValue(chart.points);
  const latest = held[held.length - 1];
  const change = changeOf(chart.points);
  const sign = (difference: number) => (difference > 0 ? `+${difference}` : String(difference));

  let note: React.ReactNode = null;
  if (chart.error) {
    note = (
      <Button kind="ghost" size="sm" onClick={() => void chart.mutate()}>
        {t('runChartTileRetry', 'Could not load. Try again')}
      </Button>
    );
  } else if (change) {
    const since = formatDate(localDay(change.from.date), { time: false, noToday: true });
    note = change.difference ? (
      <span className={change.difference > 0 ? styles.up : styles.down}>
        {kind === 'percent'
          ? t('runChartChangePoints', '{{change}} points since {{date}}', {
              change: sign(change.difference),
              date: since,
            })
          : t('runChartChangeCount', '{{change}} since {{date}}', { change: sign(change.difference), date: since })}
      </span>
    ) : (
      <span className={styles.flat}>{t('runChartNoChange', 'no change')}</span>
    );
  }
  return (
    <a
      className={`${styles.tile} ${current ? styles.current : ''}`}
      href={hrefFor(id)}
      aria-current={current ? 'true' : undefined}
      data-testid="run-chart-tile"
      onClick={(event) => {
        if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
          return;
        }
        event.preventDefault();
        onOpen(id);
      }}
    >
      <span className={styles.tileLabel}>{metricLabel(t, id)}</span>
      {chart.isLoading ? (
        <SkeletonText heading width="4rem" />
      ) : (
        <span className={styles.tileValue}>{latest ? `${latest.value}${kind === 'percent' ? '%' : ''}` : '–'}</span>
      )}
      {note}
    </a>
  );
}

/** A run chart: one metric of a clinic over a range, in days, weeks or months, with its median and shifts. */
export default function RunCharts() {
  const { t } = useTranslation();
  const { clinicLocationTags } = useConfig<Config>();
  const limit = useClinicLimit();
  const cardiac = useClinics(clinicLocationTags.cardiac);
  const primaryCare = useClinics(clinicLocationTags.primaryCare);
  const clinics = useMemo(
    () =>
      [...new Map([...cardiac, ...primaryCare].map((clinic) => [clinic.uuid, clinic])).values()].sort((a, b) =>
        a.display.localeCompare(b.display),
      ),
    [cardiac, primaryCare],
  );
  const defaults = useMemo(
    () =>
      limit.status === 'pending'
        ? ('pending' as const)
        : {
            metric: defaultMetric,
            from: isoDay(dayjs().subtract(12, 'month').toDate()),
            to: isoDay(new Date()),
            points: defaultPeriod as string,
          },
    [limit.status],
  );
  const [filters, update, pending] = useUrlFilters(filterKeys, defaults);

  const limited = limit.status === 'ready';
  const metric = isMetric(filters.metric) ? filters.metric : defaultMetric;
  const period: RunChartPeriod = isPeriod(filters.points) ? filters.points : defaultPeriod;
  const from = validDay(filters.from) ? filters.from : isoDay(dayjs().subtract(12, 'month').toDate());
  const to = validDay(filters.to) ? filters.to : isoDay(new Date());
  // A limited administrator is held to their clinics whatever the URL says, not to all clinics.
  const clinic = limited
    ? limit.uuids.includes(filters.clinic)
      ? filters.clinic
      : (clinics[0]?.uuid ?? limit.uuids[0] ?? '')
    : filters.clinic;
  const clinicName = useClinicName(clinics, clinic);
  const backwards = dayjs(from).isAfter(to, 'day');
  const waiting = pending || limit.status === 'pending' || (limited && !clinic);
  const params: RunChartParams | null =
    waiting || backwards ? null : { metric, clinic: clinic || null, startDate: from, endDate: to, points: period };

  const chart = useRunChart(params);
  const held = withValue(chart.points);
  const hasChart = held.length >= MIN_POINTS_FOR_CHART;
  const hasMedian = held.length >= MIN_POINTS_FOR_MEDIAN;
  const median = hasMedian ? chart.median : null;
  const runs = useMemo(() => shifts(chart.points, median), [chart.points, median]);

  const hrefFor = (id: string) => {
    const query = new URLSearchParams(window.location.search);
    query.set('metric', id);
    return `${window.location.pathname}?${query}`;
  };
  const label = metricLabel(t, metric);
  const kind = kindOf(metric);

  const body = () => {
    if (limited && !clinic && !pending) {
      return (
        <InlineNotification
          kind="info"
          lowContrast
          hideCloseButton
          title={t('runChartNoClinic', 'No clinic on your account to chart')}
        />
      );
    }
    if (waiting) {
      return <SkeletonText paragraph lineCount={5} />;
    }
    if (backwards) {
      return null;
    }
    if (chart.error) {
      return (
        <div className={styles.history}>
          <InlineNotification
            kind="error"
            lowContrast
            hideCloseButton
            statusIconDescription={t('errorIcon', 'error icon')}
            title={t('runChartCouldNotLoad', 'Could not load the run chart')}
          />
          <Button size="md" onClick={() => void chart.mutate()}>
            {t('tryAgain', 'Try again')}
          </Button>
        </div>
      );
    }
    if (chart.isLoading) {
      return <SkeletonText paragraph lineCount={5} />;
    }
    if (!hasChart) {
      return <HistoryNotice params={params} clinic={clinicName} />;
    }
    return (
      <>
        <RunChartLine
          name={`${label}, ${clinicName}`}
          points={chart.points}
          median={median}
          shifts={runs}
          period={period}
          kind={kind}
        />
        <div className={styles.notes}>
          <span>
            {chart.lastSnapshot
              ? t('runChartNightly', 'Snapshots are taken every night at 02:05. Last: {{date}}.', {
                  date: formatDate(localDay(chart.lastSnapshot), { time: false, noToday: true }),
                })
              : t('runChartNightlyNone', 'Snapshots are taken every night at 02:05.')}
          </span>
          <span>{t('runChartHistoryStarts', 'History starts on the first night the snapshot ran.')}</span>
        </div>
      </>
    );
  };

  return (
    <>
      <ActPageHeader title={t('runCharts', 'Run charts')} illustration={<ReportsPictogram />} />
      <div className={styles.page}>
        <div className={styles.crumb}>
          <ConfigurableLink to="${openmrsSpaBase}/home/act-dashboard">{t('dashboard', 'Dashboard')}</ConfigurableLink>
          {' / '}
          {t('runCharts', 'Run charts')}
        </div>
        <section className={styles.card} aria-labelledby="run-chart-title">
          <h2 id="run-chart-title" className={styles.title}>
            {t('runChartTitle', '{{metric}}, {{clinic}}', { metric: label, clinic: clinicName })}
          </h2>
          <p className={styles.sub}>
            {kind === 'percent'
              ? t(
                  'runChartPercentNote',
                  'One point per {{period}}: the period’s snapshots added up, as a share of their patients.',
                  {
                    period: periodName(t, period),
                  },
                )
              : t('runChartCountNote', 'One point per {{period}}: the period’s last snapshot.', {
                  period: periodName(t, period),
                })}
          </p>
          <div className={styles.filters}>
            <div className={styles.metricField}>
              <Select
                id="run-chart-metric"
                labelText={t('metric', 'Metric')}
                value={metric}
                onChange={(event) => update({ metric: event.target.value })}
              >
                {runChartMetrics.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id} text={metricLabel(t, entry.id)} />
                ))}
              </Select>
            </div>
            <div className={styles.field}>
              <Select
                id="run-chart-clinic"
                labelText={t('clinic', 'Clinic')}
                value={clinic}
                onChange={(event) => update({ clinic: event.target.value })}
              >
                {!limited && <SelectItem value="" text={t('allClinics', 'All clinics')} />}
                {clinics.map((entry) => (
                  <SelectItem key={entry.uuid} value={entry.uuid} text={entry.display} />
                ))}
              </Select>
            </div>
            <OpenmrsDatePicker
              id="run-chart-from"
              labelText={t('fromDate', 'From')}
              value={localDay(from)}
              onChange={(date) => date && update({ from: isoDay(date) })}
            />
            <OpenmrsDatePicker
              id="run-chart-to"
              labelText={t('toDate', 'To')}
              value={localDay(to)}
              invalid={backwards}
              invalidText={t('endBeforeStart', 'The end is before the start')}
              onChange={(date) => date && update({ to: isoDay(date) })}
            />
            <ContentSwitcher
              size="md"
              selectedIndex={['day', 'week', 'month'].indexOf(period)}
              onChange={({ name }) => update({ points: String(name) })}
            >
              <Switch name="day" text={t('day', 'Day')} />
              <Switch name="week" text={t('week', 'Week')} />
              <Switch name="month" text={t('month', 'Month')} />
            </ContentSwitcher>
          </div>
          {body()}
        </section>
        <section aria-labelledby="run-chart-all">
          <h2 id="run-chart-all" className={styles.title}>
            {t('runChartAllMetrics', 'All eight metrics, {{clinic}}', { clinic: clinicName })}
          </h2>
          <div className={styles.tiles}>
            {runChartMetrics.map((entry) => (
              <MetricTile
                key={entry.id}
                id={entry.id}
                params={params}
                current={entry.id === metric}
                hrefFor={hrefFor}
                onOpen={(id) => update({ metric: id })}
              />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
