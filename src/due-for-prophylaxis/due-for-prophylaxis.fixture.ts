import { type ReportRow } from '../reports/report-dataset.resource';

/** Rows as the Due for Prophylaxis report sends them, most overdue first: three on BPG, one oral. */
export const dueRows: Array<ReportRow> = [
  {
    patient_uuid: 'patient-overdue',
    full_name: 'Amina Nakato',
    rhd_id: 'rhd00012',
    prophylaxis_type: 'BPG',
    injection_interval_days: 28,
    regimen: 'Benzathine penicillin G',
    last_given: '2026-08-24T00:00:00.000+0000',
    next_due: '2026-09-21T00:00:00.000+0000',
    status: 'overdue',
    adherence: 64,
    primary_care_clinic: 'Kiswa HC III',
  },
  {
    patient_uuid: 'patient-oral',
    full_name: 'Joan Apio',
    rhd_id: 'rhd00021',
    prophylaxis_type: 'Oral',
    injection_interval_days: 0,
    regimen: 'Penicillin V',
    last_given: null,
    next_due: '2026-09-28T00:00:00.000+0000',
    status: 'due_today',
    adherence: 70,
    primary_care_clinic: 'Kiswa HC III',
  },
  {
    patient_uuid: 'patient-today',
    full_name: 'Abebe Zeleke',
    rhd_id: 'rhd00003',
    prophylaxis_type: 'BPG',
    injection_interval_days: 28,
    regimen: 'Benzathine penicillin G',
    last_given: '2026-08-31T00:00:00.000+0000',
    next_due: '2026-09-28T00:00:00.000+0000',
    status: 'due_today',
    adherence: 83,
    primary_care_clinic: 'Kiswa HC III',
  },
  {
    patient_uuid: 'patient-soon',
    full_name: 'Peter Mugisha',
    rhd_id: 'rhd00052',
    prophylaxis_type: 'BPG',
    injection_interval_days: 28,
    regimen: 'Benzathine penicillin G',
    last_given: '2026-08-26T00:00:00.000+0000',
    next_due: '2026-09-29T00:00:00.000+0000',
    status: 'due_soon',
    adherence: null,
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
