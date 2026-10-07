/** Rows shaped as the Screen Positive, Pending Confirmation report returns them. */
export const screenPositiveRows = Array.from({ length: 30 }, (_, i) => ({
  rhd_id: `rhd${String(i + 1).padStart(5, '0')}`,
  full_name: `Patient ${i + 1}`,
  age_years: 8 + i,
  sex: i % 2 ? 'M' : 'F',
  cardiac_clinic: i % 3 ? 'Gulu RRH' : 'Lira RRH',
  primary_care_clinic: i % 3 ? 'Anyeke HCIV' : null,
  screen_date: '2026-09-17',
  patient_uuid: `patient-${i + 1}`,
  encounter_uuid: `information-${i + 1}`,
  form_uuid: 'a6646c51-130d-3b59-a442-959bea93487d',
}));
