import { type ReportRow } from '../reports/report-dataset.resource';

/**
 * A registry row as the due list's table reads it, for a patient on prophylaxis or without a prescription; nothing for
 * a patient whose prophylaxis ACT Core has not typed yet. A BPG patient past their due date is overdue, else up to date.
 */
export function asProphylaxisRow(row: ReportRow): ReportRow | null {
  const common = {
    patient_uuid: row.patient_uuid,
    full_name: row.full_name,
    rhd_id: row.rhd_id,
    regimen: row.prophylaxis_regimen,
    last_given: row.last_injection_date,
    adherence: row.adherence,
  };
  if (row.bpg_status === 'No prescription') {
    return { ...common, prophylaxis_type: '', status: 'no_prescription' };
  }
  if (row.prophylaxis_type === 'BPG') {
    const status = row.bpg_status === 'Not covered' ? 'overdue' : row.bpg_status ? 'up_to_date' : '';
    return { ...common, prophylaxis_type: 'BPG', injection_interval_days: row.injection_interval_days, status };
  }
  return row.prophylaxis_type === 'Oral' ? { ...common, prophylaxis_type: 'Oral', status: '' } : null;
}
