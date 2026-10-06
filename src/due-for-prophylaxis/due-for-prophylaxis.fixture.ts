import { type ReportRow } from '../reports/report-dataset.resource';

/** Rows as the Due for Prophylaxis report sends them, most overdue first. */
export const dueRows: Array<ReportRow> = [
  {
    patient_uuid: 'patient-overdue',
    full_name: 'Amina Nakato',
    rhd_id: 'rhd00012',
    prophylaxis_type: 'BPG',
    last_given: '2026-08-24T00:00:00.000+0000',
    next_due: '2026-09-21T00:00:00.000+0000',
    status: 'overdue',
    primary_care_clinic: 'Kiswa HC III',
  },
  {
    patient_uuid: 'patient-oral',
    full_name: 'Joan Apio',
    rhd_id: 'rhd00021',
    prophylaxis_type: 'Oral',
    last_given: null,
    next_due: '2026-09-28T00:00:00.000+0000',
    status: 'due_today',
    primary_care_clinic: 'Kiswa HC III',
  },
  {
    patient_uuid: 'patient-today',
    full_name: 'Abebe Zeleke',
    rhd_id: 'rhd00003',
    prophylaxis_type: 'BPG',
    last_given: '2026-08-31T00:00:00.000+0000',
    next_due: '2026-09-28T00:00:00.000+0000',
    status: 'due_today',
    primary_care_clinic: 'Kiswa HC III',
  },
];

/** More rows than the widget shows and the page's first page holds, each overdue. */
export function manyDueRows(count: number): Array<ReportRow> {
  return Array.from({ length: count }, (_, i) => ({
    ...dueRows[0],
    patient_uuid: `patient-${i}`,
    full_name: `Patient ${i}`,
    rhd_id: `rhd${String(100 + i).padStart(5, '0')}`,
  }));
}
