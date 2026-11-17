import { type ReportRow } from './report-dataset.resource';

/** The active primary diagnosis as the registry report gives it: its details (RHD B and so on), else its category. */
export function diagnosis(row: ReportRow) {
  return String(row.diagnosis_details || row.diagnosis_category || '');
}
