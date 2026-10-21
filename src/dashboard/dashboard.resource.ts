import { type ReportRow } from '../reports/report-dataset.resource';

/** A chart point as Carbon Charts reads it: the series is `group`, the bar or slice `key`. */
export interface ChartDatum {
  group: string;
  key: string;
  value: number;
}

const count = (row: ReportRow) => Number(row.patients ?? 0);

/** Sums each row's patients under the label it gives, in the order given and then in the order met. */
function tally(rows: Array<ReportRow>, label: (row: ReportRow) => string, order: Array<string> = []) {
  const totals = new Map<string, number>(order.map((key) => [key, 0]));
  rows.forEach((row) => {
    const key = label(row);
    totals.set(key, (totals.get(key) ?? 0) + count(row));
  });
  return [...totals].map(([key, value]) => ({ key, value }));
}

export const total = (rows: Array<ReportRow>) => rows.reduce((sum, row) => sum + count(row), 0);

export const RHD_CATEGORY = 'Rheumatic Heart Disease/Rheumatic Fever';
export const ACTIVE = 'Active';
export const NOT_RECORDED = 'Not recorded';

const sexes = { F: 'Female', M: 'Male', O: 'Other', U: 'Unknown' };
const sexLabel = (row: ReportRow) => sexes[String(row.sex)] ?? NOT_RECORDED;

/** ACT 2.0's disease chart: the category, Rheumatic Heart Disease/Rheumatic Fever split by its details. */
export const diseaseLabel = (row: ReportRow) =>
  row.category ? String(row.category === RHD_CATEGORY && row.details ? row.details : row.category) : 'None';

/**
 * The registrants report's rows as the Dashboard's charts: every patient by status, and the active ones by age band,
 * sex and disease, of the category given or of all.
 */
export function registrantCharts(rows: Array<ReportRow>, category = '') {
  const active = rows.filter((row) => row.status === ACTIVE && (!category || String(row.category ?? '') === category));
  const bands = ['0-9', '10-19', '20-39', '40+'];
  return {
    total: total(rows),
    active: total(rows.filter((row) => row.status === ACTIVE)),
    status: tally(rows, (row) => String(row.status), [ACTIVE]).map(({ key, value }) => ({ group: key, key, value })),
    age: tally(active, (row) => (row.age_band ? String(row.age_band) : NOT_RECORDED), bands),
    sex: tally(active, sexLabel),
    disease: tally(active, diseaseLabel),
    categories: [...new Set(rows.filter((row) => row.category).map((row) => String(row.category)))].sort(),
  };
}

export const procedures = ['Mitral balloon valvuloplasty', 'Mitral valve surgery', 'Aortic valve surgery', 'Other'];
export const optimisationQuestions = [
  'Retained in care',
  'Echocardiogram',
  'Procedural recommendation',
  'Procedures completed',
];
export const INR_QUESTION = 'INR within 3 months';

/** The care report's rows as the waitlist by procedure and urgency, procedures performed and Yes or No per question. */
export function careCharts(rows: Array<ReportRow>) {
  const of = (measure: string) => rows.filter((row) => row.measure === measure);
  const waitlist: Array<ChartDatum> = of('waitlist').map((row) => ({
    group: row.grouping ? String(row.grouping) : NOT_RECORDED,
    key: String(row.label),
    value: count(row),
  }));
  const performed = Object.fromEntries(of('performed').map((row) => [String(row.label), count(row)]));
  // Yes first, so it keeps its colour in every chart
  const answers = of('medicalOptimisation')
    .map((row) => ({ group: String(row.grouping), key: String(row.label), value: count(row) }))
    .sort((a, b) => Number(b.group === 'Yes') - Number(a.group === 'Yes'));
  return {
    waitlist,
    waitlistTotal: waitlist.reduce((sum, datum) => sum + datum.value, 0),
    bmvPerformed: performed['Mitral balloon valvuloplasty'] ?? 0,
    proceduresPerformed: performed['All procedures'] ?? 0,
    optimisation: answers.filter((datum) => datum.key !== INR_QUESTION),
    inr: answers.filter((datum) => datum.key === INR_QUESTION),
  };
}

/** The screening cascade's steps after Active, as ACT 2.0 drew them, each with its share of the step before. */
export function screeningCascadeSteps(rows: Array<ReportRow>) {
  const byStep = new Map(rows.map((row) => [String(row.step), count(row)]));
  const steps = ['Confirmatory Diagnosis', 'Diagnosed', 'Heart Disease'];
  return steps.map((step, i) => {
    const value = byStep.get(step) ?? 0;
    const parent = i ? (byStep.get(steps[i - 1]) ?? 0) : null;
    return { step, value, share: parent ? Math.round((value / parent) * 100) : null };
  });
}

const screeningAges = { '0-9': 'Children (0-9)', '10-19': 'Adolescents (10-19)', '20+': 'Adults (20+)' };

/** The screening report's rows as ACT 2.0's screening section, over the registry's patients. */
export function screeningCharts(rows: Array<ReportRow>) {
  const all = total(rows);
  const female = total(rows.filter((row) => row.sex === 'F'));
  return {
    total: all,
    percentFemale: all ? Math.round((female / all) * 100) : null,
    screenPositive: tally(rows, (row) => (row.screen_positive ? String(row.screen_positive) : NOT_RECORDED), [
      'Yes',
      'No',
    ]),
    age: tally(rows, (row) => screeningAges[String(row.age_band)] ?? NOT_RECORDED, Object.values(screeningAges)),
    detectedBy: tally(rows, (row) => (row.detected_by ? String(row.detected_by) : NOT_RECORDED), [
      'School',
      'Community',
      'Facility',
    ]).map(({ key, value }) => ({ group: key, key, value })),
  };
}
