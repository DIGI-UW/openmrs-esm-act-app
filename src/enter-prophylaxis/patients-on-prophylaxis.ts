import { type ReportRow } from '../reports/report-dataset.resource';

/** Overdue, due today, due in the next two days or up to date, as the Due for Prophylaxis report words it. */
function dueStatus(daysUntilDue: unknown) {
  if (daysUntilDue === null || daysUntilDue === undefined || daysUntilDue === '') {
    return '';
  }
  const days = Number(daysUntilDue);
  return days < 0 ? 'overdue' : days === 0 ? 'due_today' : days <= 2 ? 'due_soon' : 'up_to_date';
}

/**
 * A registry row as the due list's table reads it, for a patient on prophylaxis or without a prescription; nothing for
 * a patient whose prophylaxis ACT Core has not typed yet. A BPG or oral patient's status counts days to their due date.
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
    return {
      ...common,
      prophylaxis_type: 'BPG',
      injection_interval_days: row.injection_interval_days,
      status: dueStatus(row.days_until_due),
    };
  }
  return row.prophylaxis_type === 'Oral'
    ? { ...common, prophylaxis_type: 'Oral', status: dueStatus(row.days_until_due) }
    : null;
}
