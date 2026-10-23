import { onRegistryNow } from '../registry/registry.resource';
import { type ReportRow } from '../reports/report-dataset.resource';

export interface Count {
  label: string;
  value: number;
}

const RHD_CATEGORY = 'Rheumatic Heart Disease/Rheumatic Fever';

/** Counts of each label, largest first, then by label. */
function tally(labels: Array<string>): Array<Count> {
  const counts = new Map<string, number>();
  labels.forEach((label) => counts.set(label, (counts.get(label) ?? 0) + 1));
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

/** A registry row's clinic names, for the dashboard's clinic filters. */
export const rowClinics = (row: ReportRow) => ({
  cardiac: String(row.cardiac_clinic ?? ''),
  primaryCare: String(row.primary_care_clinic ?? ''),
});

/** The rows of the clinics chosen, by name: a clinic left at All matches every row. */
export function ofClinics(rows: Array<ReportRow>, clinics: { cardiac?: string; primaryCare?: string }) {
  return rows.filter((row) => {
    const named = rowClinics(row);
    return (
      (!clinics.cardiac || named.cardiac === clinics.cardiac) &&
      (!clinics.primaryCare || named.primaryCare === clinics.primaryCare)
    );
  });
}

/**
 * Each registrant's status, as ACT 2.0's status pie: Active while enrolled and alive; otherwise the registry
 * programme's state they ended in, such as Inactive - Death; Died for a death the enrolment does not record; None for
 * an enrolment completed without a state.
 */
export function registrantStatus(row: ReportRow) {
  const deceased = row.deceased === true || Number(row.deceased) === 1;
  if (row.enrollment_status === 'Active' && !deceased) {
    return 'Active';
  }
  if (row.enrollment_status !== 'Active' && row.current_state) {
    return String(row.current_state);
  }
  return deceased ? 'Died' : 'None';
}

/** ACT 2.0's age bands: 0-9, 10-19, 20-39 and 40+. */
export function ageBand(age: unknown) {
  const years = Number(age);
  if (age === null || age === undefined || age === '' || Number.isNaN(years)) {
    return 'Unknown';
  }
  return years < 10 ? '0-9' : years < 20 ? '10-19' : years <= 39 ? '20-39' : '40+';
}

const ageBandOrder = ['0-9', '10-19', '20-39', '40+', 'Unknown'];

/**
 * ACT 2.0's disease category chart: each active patient's diagnosis category, except that Rheumatic Heart Disease is
 * broken into its diagnosis details (RHD A, RHD B and so on); a patient with no category counts as None.
 */
export function diseaseCategory(row: ReportRow) {
  const category = String(row.diagnosis_category ?? '');
  if (!category) {
    return 'None';
  }
  return category === RHD_CATEGORY && row.diagnosis_details ? String(row.diagnosis_details) : category;
}

/** The registrant status, sex, age band and disease category counts of the registry rows given. */
export function registrantCounts(rows: Array<ReportRow>) {
  const active = rows.filter(onRegistryNow);
  const ages = tally(active.map((row) => ageBand(row.age_years)));
  return {
    status: tally(rows.map(registrantStatus)),
    sex: tally(active.map((row) => (row.sex === 'F' ? 'Female' : row.sex === 'M' ? 'Male' : 'Unknown'))),
    age: ageBandOrder.flatMap((band) => ages.filter((count) => count.label === band)),
    category: tally(active.map(diseaseCategory)),
    active: active.length,
  };
}

/**
 * ACT 2.0's procedural waitlist chart: the open recommendations counted by procedure and by urgency, from the
 * Procedural Waiting List's rows. Urgencies sort by their leading number (1: Emergent, 2: Urgent, 3: Elective).
 */
export function waitlistCounts(rows: Array<ReportRow>) {
  const label = (value: unknown, none: string) => String(value ?? '').trim() || none;
  const procedures = [...new Set(rows.map((row) => label(row.procedure_name, 'Not given')))].sort();
  const urgencies = [...new Set(rows.map((row) => label(row.urgency, 'Not given')))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
  const cells = procedures.map((procedure) => ({
    procedure,
    counts: urgencies.map(
      (urgency) =>
        rows.filter(
          (row) => label(row.procedure_name, 'Not given') === procedure && label(row.urgency, 'Not given') === urgency,
        ).length,
    ),
  }));
  return { urgencies, rows: cells, total: rows.length };
}

export const share = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

export const cascadeShares = (steps: Array<Count>) =>
  steps.map((step, index) => ({ ...step, share: index ? share(step.value, steps[index - 1].value) : null }));
