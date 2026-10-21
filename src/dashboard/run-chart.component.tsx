import React, { useState } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { LineChart, ScaleTypes } from '@carbon/charts-react';
import '@carbon/charts-react/styles.css';
import { InlineNotification, Select, SelectItem, SkeletonText } from '@carbon/react';
import { formatDate, OpenmrsDatePicker } from '@openmrs/esm-framework';
import { ActHomeCard } from '../act-home/act-home-card.component';
import { runChartMetrics, useRunChart } from './run-chart.resource';
import styles from './dashboard.scss';

/**
 * ACT 2.0's run charts: a metric's daily snapshots over a date range, of the clinic chosen above. With a cardiac and a
 * primary care clinic both chosen, the cardiac clinic's. The default export is what the Dashboard loads lazily, with
 * the charts library.
 */
export default function RunChartSection({ scope }: { scope: Record<string, string> | undefined }) {
  const { t } = useTranslation();
  const labels: Record<string, string> = {
    total_registrants: t('totalRegistrants', 'Total registrants'),
    active_registrants: t('activeRegistrants', 'Active registrants'),
    active_registrants_seen_last_7_months: t(
      'percentRetainedInCare',
      'Percent of active registrants seen in the last 7 months (retained in care)',
    ),
    active_registrants_prescribed_prophylaxis: t(
      'percentPrescribedProphylaxis',
      'Percent of active registrants prescribed prophylaxis',
    ),
    active_registrants_adherent: t('percentAdherent', 'Percent of active registrants adherent 80% or more'),
    consultation_visits_with_echocardiogram_resulted: t(
      'percentVisitsWithEcho',
      'Percent of consultation visits with an echocardiogram resulted',
    ),
    consultation_visits_with_intervention: t(
      'percentVisitsWithRecommendation',
      'Percent of consultation visits with a procedural recommendation',
    ),
    interventions_completed: t('proceduresCompleted', 'Procedures completed'),
  };
  const [metric, setMetric] = useState<string>(runChartMetrics[0].metric);
  // ACT 2.0's default: the year to today
  const [startDate, setStartDate] = useState<Date>(() => dayjs().subtract(1, 'year').startOf('day').toDate());
  const [endDate, setEndDate] = useState<Date>(() => dayjs().startOf('day').toDate());
  const backwards = dayjs(endDate).isBefore(startDate, 'day');
  const clinic = scope?.cardiacClinic ?? scope?.primaryCareClinic;
  const { runChart, error, isLoading } = useRunChart(
    metric,
    clinic,
    dayjs(startDate).format('YYYY-MM-DD'),
    dayjs(backwards ? startDate : endDate).format('YYYY-MM-DD'),
  );
  const percent = runChartMetrics.find((m) => m.metric === metric)?.percent;
  const data = (runChart?.points ?? [])
    .filter((point) => point.value !== null)
    // A plain day, read at local midnight, so the chart does not place it at the hour the browser is ahead of UTC.
    .map((point) => ({ group: labels[metric], date: `${point.date}T00:00:00`, value: point.value }));

  return (
    <ActHomeCard title={t('runCharts', 'Run charts')}>
      <div className={styles.runChartFilters}>
        <Select
          id="dashboard-run-chart-metric"
          labelText={t('displayMetric', 'Display metric')}
          size="sm"
          value={metric}
          onChange={(event) => setMetric(event.target.value)}
        >
          {runChartMetrics.map(({ metric: key }) => (
            <SelectItem key={key} value={key} text={labels[key]} />
          ))}
        </Select>
        <OpenmrsDatePicker
          id="dashboard-run-chart-start"
          labelText={t('startDate', 'Start date')}
          value={startDate}
          onChange={(date) => date && setStartDate(date)}
        />
        <OpenmrsDatePicker
          id="dashboard-run-chart-end"
          labelText={t('endDate', 'End date')}
          value={endDate}
          invalid={backwards}
          invalidText={t('endBeforeStart', 'The end is before the start')}
          onChange={(date) => date && setEndDate(date)}
        />
      </div>
      {scope?.cardiacClinic && scope?.primaryCareClinic && (
        <p className={styles.note}>
          {t('runChartOneClinic', 'Run charts are kept per clinic, so they show the cardiac clinic chosen')}
        </p>
      )}
      {error ? (
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title={t('couldNotLoadSection', 'Could not load {{section}}', { section: t('runCharts', 'Run charts') })}
        />
      ) : isLoading ? (
        <SkeletonText paragraph lineCount={5} />
      ) : data.length ? (
        <LineChart
          data={data}
          options={{
            height: '300px',
            toolbar: { enabled: false },
            animations: false,
            legend: { enabled: false },
            axes: {
              bottom: {
                mapsTo: 'date',
                scaleType: ScaleTypes.TIME,
                ticks: { formatter: (tick) => formatDate(new Date(tick as Date), { time: false, noToday: true }) },
              },
              left: {
                mapsTo: 'value',
                ...(percent
                  ? { title: '%', domain: [0, 100] }
                  : { ticks: { formatter: (tick) => (Number.isInteger(tick) ? String(tick) : '') } }),
              },
            },
          }}
        />
      ) : (
        <p className={styles.empty}>{t('noSnapshots', 'No snapshot was taken in this period')}</p>
      )}
      <p className={styles.note}>
        {runChart?.lastSnapshot
          ? t('lastSnapshot', 'Snapshots are taken daily; the last on {{date}}', {
              date: formatDate(dayjs(runChart.lastSnapshot).toDate(), { time: false, noToday: true }),
            })
          : t('noSnapshotYet', 'Snapshots are taken daily; none has been taken yet')}
      </p>
    </ActHomeCard>
  );
}
