import { type Config } from '../config-schema';
import { type ReportRow } from '../reports/report-dataset.resource';

export function cascadeSteps(rows: Array<ReportRow>, steps: Config['careCascade']['steps']) {
  const byStep = new Map(rows.map((row) => [String(row.step), Number(row.patients ?? 0)]));
  return steps
    .filter(({ step }) => byStep.has(step))
    .map(({ step, label }) => ({ step, label, value: byStep.get(step) }));
}
