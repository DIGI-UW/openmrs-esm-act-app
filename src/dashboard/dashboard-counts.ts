import { type TFunction } from 'i18next';
import { type ReportRow } from '../reports/report-dataset.resource';

export interface Count {
  label: string;
  value: number;
}

const ageBandOrder = ['0-9', '10-19', '20-39', '40+', 'Age unknown'];

function breakdownOf(rows: Array<ReportRow>, breakdown: string): Array<Count> {
  return rows
    .filter((row) => row.breakdown === breakdown)
    .map((row) => ({ label: String(row.label), value: Number(row.patients ?? 0) }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

export function registrantCounts(rows: Array<ReportRow>) {
  const status = breakdownOf(rows, 'status');
  const ages = breakdownOf(rows, 'age');
  return {
    status,
    sex: breakdownOf(rows, 'sex'),
    // A band the order does not name sorts last.
    age: [...ages].sort(
      (a, b) => (ageBandOrder.indexOf(a.label) + 1 || 99) - (ageBandOrder.indexOf(b.label) + 1 || 99),
    ),
    category: breakdownOf(rows, 'disease'),
    registered: status.reduce((sum, count) => sum + count.value, 0),
    active: status.find((count) => count.label === 'Active')?.value ?? 0,
  };
}

/** What the waitlist calls a procedure or urgency the report leaves out; a figure opens by it, untranslated. */
const notGiven = 'Not given';

/** A waitlist procedure or urgency as shown: the one the report leaves out translated, the report's own as it is. */
export const waitlistName = (t: TFunction, name: string) => (name === notGiven ? t('notGiven', 'Not given') : name);

export function waitlistCounts(rows: Array<ReportRow>) {
  const named = (value: unknown) => String(value ?? '').trim() || notGiven;
  const open = rows
    .filter((row) => row.breakdown === 'open')
    .map((row) => ({
      procedure: named(row.procedure),
      urgency: named(row.urgency),
      recommendations: Number(row.recommendations ?? 0),
    }));
  const total = rows.find((row) => row.breakdown === 'total');
  const performed = (procedure: string) =>
    Number(rows.find((row) => row.breakdown === 'performed' && row.procedure === procedure)?.recommendations ?? 0);
  const procedures = [...new Set(open.map((row) => String(row.procedure)))].sort();
  const urgencies = [...new Set(open.map((row) => String(row.urgency)))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
  const cells = procedures.map((procedure) => ({
    procedure,
    counts: urgencies.map((urgency) =>
      open
        .filter((row) => row.procedure === procedure && row.urgency === urgency)
        .reduce((sum, row) => sum + row.recommendations, 0),
    ),
  }));
  return {
    urgencies,
    rows: cells,
    total: Number(total?.recommendations ?? 0),
    patients: Number(total?.patients ?? 0),
    performed: { bmv: performed('Mitral balloon valvuloplasty'), surgery: performed('Surgery') },
  };
}

export const share = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

/** Each step's share of the step before, or of the step `shareOf` names for it. */
export const cascadeShares = (steps: Array<Count>, shareOf: Record<string, string> = {}) =>
  steps.map((step, index) => {
    const of = shareOf[step.label] ? steps.find((other) => other.label === shareOf[step.label]) : steps[index - 1];
    return { ...step, share: of ? share(step.value, of.value) : null };
  });
