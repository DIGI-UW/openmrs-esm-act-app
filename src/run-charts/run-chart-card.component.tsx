import React, { useMemo } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { Button, InlineNotification, SkeletonText } from '@carbon/react';
import { useConfig } from '@openmrs/esm-framework';
import { ActHomeCard } from '../act-home/act-home-card.component';
import { useClinicLimit } from '../clinic-limit';
import { type Config } from '../config-schema';
import { useClinics } from '../programme-report/clinics.resource';
import { HistoryNotice } from './run-chart-history-notice.component';
import { useClinicName } from './run-chart-clinic-name';
import { RunChartLine } from './run-chart-line.component';
import { defaultMetric, defaultPeriod, kindOf, metricLabel } from './run-chart-metrics';
import { MIN_POINTS_FOR_CHART, MIN_POINTS_FOR_MEDIAN, shifts, withValue } from './run-chart-stats';
import { pointDetail } from './run-chart-tooltip';
import { type RunChartParams, useRunChart } from './run-chart.resource';
import styles from './run-charts.scss';

/**
 * The Dashboard's run charts card: the default metric at the primary care clinic chosen, else the cardiac clinic, else
 * every clinic. A limited administrator gets their own clinic, as every clinic's row cannot be limited.
 */
export function RunChartCard({ scope }: { scope: Record<string, string> }) {
  const { t } = useTranslation();
  const { clinicLocationTags } = useConfig<Config>();
  const limit = useClinicLimit();
  const cardiac = useClinics(clinicLocationTags.cardiac);
  const primaryCare = useClinics(clinicLocationTags.primaryCare);
  const clinics = useMemo(() => [...cardiac, ...primaryCare], [cardiac, primaryCare]);

  const limited = limit.status === 'ready';
  const chosen = scope.primaryCareClinic || scope.cardiacClinic || '';
  const clinic = limited ? (limit.uuids.includes(chosen) ? chosen : (limit.uuids[0] ?? '')) : chosen;
  const clinicName = useClinicName(clinics, clinic);
  const waiting = limit.status === 'pending' || (limited && !clinic);
  const params: RunChartParams | null = waiting
    ? null
    : {
        metric: defaultMetric,
        clinic: clinic || null,
        startDate: dayjs().subtract(12, 'month').format('YYYY-MM-DD'),
        endDate: dayjs().format('YYYY-MM-DD'),
        points: defaultPeriod,
      };
  const chart = useRunChart(params);
  const held = withValue(chart.points);
  const median = held.length >= MIN_POINTS_FOR_MEDIAN ? chart.median : null;
  const runs = useMemo(() => shifts(chart.points, median), [chart.points, median]);
  const kind = kindOf(defaultMetric);
  const label = metricLabel(t, defaultMetric);
  const latest = held[held.length - 1];

  const query = new URLSearchParams({ metric: defaultMetric });
  if (clinic) {
    query.set('clinic', clinic);
  }

  let body: React.ReactNode;
  if (limited && !clinic) {
    body = <p className={styles.cardNote}>{t('runChartNoClinic', 'No clinic on your account to chart')}</p>;
  } else if (waiting || chart.isLoading) {
    body = <SkeletonText paragraph lineCount={5} />;
  } else if (chart.error) {
    body = (
      <div className={styles.history}>
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          statusIconDescription={t('errorIcon', 'error icon')}
          title={t('runChartCouldNotLoad', 'Could not load the run chart')}
          subtitle={t('restOfDashboardUpToDate', 'The rest of the Dashboard is up to date.')}
        />
        <Button size="md" onClick={() => void chart.mutate()}>
          {t('tryAgain', 'Try again')}
        </Button>
      </div>
    );
  } else if (held.length < MIN_POINTS_FOR_CHART) {
    body = <HistoryNotice params={params} clinic={clinicName} />;
  } else {
    body = (
      <>
        <p className={styles.cardMetric} data-testid="run-chart-latest">
          {pointDetail(t, defaultPeriod, kind, latest)}
        </p>
        {median !== null && (
          <p className={styles.cardNote}>{t('runChartMedianValue', 'Median {{value}}', { value: median })}</p>
        )}
        <RunChartLine
          name={`${label}, ${clinicName}`}
          points={chart.points}
          median={median}
          shifts={runs}
          period={defaultPeriod}
          kind={kind}
          height="14rem"
          compact
        />
      </>
    );
  }

  return (
    <ActHomeCard
      title={t('runChartTitle', '{{metric}}, {{clinic}}', { metric: label, clinic: clinicName })}
      link={{ label: t('openRunCharts', 'Open run charts'), to: `\${openmrsSpaBase}/home/act-run-charts?${query}` }}
    >
      {body}
    </ActHomeCard>
  );
}
