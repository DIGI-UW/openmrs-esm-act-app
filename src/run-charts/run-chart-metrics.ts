import { type TFunction } from 'i18next';

/** A count metric is a total; a percent metric is a share of another figure, which the endpoint also gives. */
export type RunChartMetricKind = 'count' | 'percent';

/** How a range is cut into points: each point is the figure as of the last day of its period. */
export type RunChartPeriod = 'day' | 'week' | 'month';

export interface RunChartMetric {
  id: string;
  kind: RunChartMetricKind;
}

/** ACT Core's eight run chart metrics, in the order of the design's tiles. */
export const runChartMetrics: Array<RunChartMetric> = [
  { id: 'total_registrants', kind: 'count' },
  { id: 'active_registrants', kind: 'count' },
  { id: 'active_registrants_seen_last_7_months', kind: 'percent' },
  { id: 'active_registrants_prescribed_prophylaxis', kind: 'percent' },
  { id: 'active_registrants_adherent', kind: 'percent' },
  { id: 'consultation_visits_with_echocardiogram_resulted', kind: 'percent' },
  { id: 'consultation_visits_with_intervention', kind: 'percent' },
  { id: 'interventions_completed', kind: 'count' },
];

/** The page opens on this metric, as the design does, so it is never empty. */
export const defaultMetric = 'active_registrants_seen_last_7_months';

export const defaultPeriod: RunChartPeriod = 'week';

export const kindOf = (id: string): RunChartMetricKind =>
  runChartMetrics.find((metric) => metric.id === id)?.kind ?? 'count';

export const isMetric = (id: string | null | undefined): id is string =>
  runChartMetrics.some((metric) => metric.id === id);

export const isPeriod = (value: string | null | undefined): value is RunChartPeriod =>
  value === 'day' || value === 'week' || value === 'month';

export function metricLabel(t: TFunction, id: string) {
  switch (id) {
    case 'total_registrants':
      return t('runChartMetricTotalRegistrants', 'Total registrants');
    case 'active_registrants':
      return t('runChartMetricActiveRegistrants', 'Active registrants');
    case 'active_registrants_seen_last_7_months':
      return t('runChartMetricRetainedInCare', 'Retained in care (seen in 7 months), % of active registrants');
    case 'active_registrants_prescribed_prophylaxis':
      return t('runChartMetricPrescribed', 'Prescribed prophylaxis, % of active registrants');
    case 'active_registrants_adherent':
      return t('runChartMetricAdherent', 'Adherent 80%+, % of active registrants');
    case 'consultation_visits_with_echocardiogram_resulted':
      return t('runChartMetricEcho', 'Consultations with an echo in 13 months, %');
    case 'consultation_visits_with_intervention':
      return t('runChartMetricRecommendation', 'Consultations with a procedural recommendation, %');
    case 'interventions_completed':
      return t('runChartMetricProceduresCompleted', 'Procedures completed');
    default:
      return id;
  }
}

export function periodName(t: TFunction, period: RunChartPeriod) {
  switch (period) {
    case 'day':
      return t('periodDay', 'day');
    case 'month':
      return t('periodMonth', 'month');
    default:
      return t('periodWeek', 'week');
  }
}

export function periodNames(t: TFunction, period: RunChartPeriod) {
  switch (period) {
    case 'day':
      return t('periodDays', 'days');
    case 'month':
      return t('periodMonths', 'months');
    default:
      return t('periodWeeks', 'weeks');
  }
}
