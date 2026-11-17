/** Rows shaped as the RHD Patient List report returns them. */
export const registryRows = Array.from({ length: 30 }, (_, i) => ({
  rhd_id: `rhd${String(i + 1).padStart(5, '0')}`,
  full_name: `Patient ${i + 1}`,
  sex: i % 2 ? 'M' : 'F',
  age_years: 10 + i,
  enrollment_status: i === 3 ? 'Completed' : 'Active',
  diagnosis_category: ['RHD A', 'RHD B', 'RHD C'][i % 3],
  prophylaxis_regimen: i === 1 ? 'Oral penicillin V' : 'Q28 day BPG',
  next_consultation_date: i === 0 ? '2026-10-15T00:00:00.000+0000' : null,
  cardiac_clinic: i % 2 ? 'Gulu RRH' : 'Lira RRH',
  primary_care_clinic: i % 2 ? 'Anyeke HCIV' : null,
  consent_given: 'Yes',
  patient_uuid: `patient-${i + 1}`,
}));
