import { describe, expect, it } from 'vitest';
import {
  ageBand,
  diseaseCategory,
  ofClinics,
  registrantCounts,
  registrantStatus,
  waitlistCounts,
} from './dashboard-counts';

const RHD = 'Rheumatic Heart Disease/Rheumatic Fever';
const patient = (overrides: Record<string, unknown>) => ({
  enrollment_status: 'Active',
  deceased: 0,
  current_state: null,
  sex: 'F',
  age_years: 12,
  diagnosis_category: RHD,
  diagnosis_details: 'RHD B',
  cardiac_clinic: 'Gulu RRH',
  primary_care_clinic: 'Acimi HCIII',
  ...overrides,
});

describe('dashboard counts', () => {
  it("names each registrant's status as ACT 2.0's status pie did", () => {
    expect(registrantStatus(patient({}))).toBe('Active');
    expect(registrantStatus(patient({ enrollment_status: 'Completed', current_state: 'Inactive - Death' }))).toBe(
      'Inactive - Death',
    );
    expect(registrantStatus(patient({ deceased: 1 }))).toBe('Died');
    expect(registrantStatus(patient({ enrollment_status: 'Completed' }))).toBe('None');
  });

  it('bands ages as ACT 2.0 did: 0-9, 10-19, 20-39 and 40+', () => {
    expect([0, 9, 10, 19, 20, 39, 40, 71, null].map(ageBand)).toEqual([
      '0-9',
      '0-9',
      '10-19',
      '10-19',
      '20-39',
      '20-39',
      '40+',
      '40+',
      'Unknown',
    ]);
  });

  it('breaks Rheumatic Heart Disease into its details, and counts no category as None', () => {
    expect(diseaseCategory(patient({}))).toBe('RHD B');
    expect(diseaseCategory(patient({ diagnosis_details: null }))).toBe(RHD);
    expect(diseaseCategory(patient({ diagnosis_category: 'Congenital Heart Disease', diagnosis_details: 'x' }))).toBe(
      'Congenital Heart Disease',
    );
    expect(diseaseCategory(patient({ diagnosis_category: null }))).toBe('None');
  });

  it('counts status over every registrant, and sex, age and category over the active ones', () => {
    const counts = registrantCounts([
      patient({}),
      patient({ sex: 'M', age_years: 45, diagnosis_details: 'RHD A' }),
      patient({ age_years: 25 }),
      patient({ enrollment_status: 'Completed', current_state: 'Inactive - Lost to follow-up', sex: 'M' }),
      patient({ deceased: 1, age_years: 5 }),
    ]);

    expect(counts.active).toBe(3);
    expect(counts.status).toEqual([
      { label: 'Active', value: 3 },
      { label: 'Died', value: 1 },
      { label: 'Inactive - Lost to follow-up', value: 1 },
    ]);
    expect(counts.sex).toEqual([
      { label: 'Female', value: 2 },
      { label: 'Male', value: 1 },
    ]);
    expect(counts.age).toEqual([
      { label: '10-19', value: 1 },
      { label: '20-39', value: 1 },
      { label: '40+', value: 1 },
    ]);
    expect(counts.category).toEqual([
      { label: 'RHD B', value: 2 },
      { label: 'RHD A', value: 1 },
    ]);
  });

  it('keeps the rows of the clinics chosen, by name, either left at All matching every row', () => {
    const rows = [
      patient({}),
      patient({ cardiac_clinic: 'Lira RRH' }),
      patient({ primary_care_clinic: 'Akuna HCIII' }),
    ];
    expect(ofClinics(rows, {})).toHaveLength(3);
    expect(ofClinics(rows, { cardiac: 'Gulu RRH' })).toHaveLength(2);
    expect(ofClinics(rows, { cardiac: 'Gulu RRH', primaryCare: 'Acimi HCIII' })).toHaveLength(1);
  });

  it('counts the open recommendations by procedure and by urgency, urgencies in their numbered order', () => {
    const counts = waitlistCounts([
      { procedure_name: 'Mitral valve repair/replacement', urgency: '2: urgent (60 days/2 months)' },
      { procedure_name: 'Mitral valve repair/replacement', urgency: '1: emergent (24 hours)' },
      { procedure_name: 'Mitral valve repair/replacement', urgency: '2: urgent (60 days/2 months)' },
      { procedure_name: 'Aortic valve repair/replacement', urgency: '3: elective (180 days/6 months)' },
      { procedure_name: null, urgency: null },
    ]);

    expect(counts.total).toBe(5);
    expect(counts.urgencies).toEqual([
      '1: emergent (24 hours)',
      '2: urgent (60 days/2 months)',
      '3: elective (180 days/6 months)',
      'Not given',
    ]);
    expect(counts.rows).toEqual([
      { procedure: 'Aortic valve repair/replacement', counts: [0, 0, 1, 0] },
      { procedure: 'Mitral valve repair/replacement', counts: [1, 2, 0, 0] },
      { procedure: 'Not given', counts: [0, 0, 0, 1] },
    ]);
  });
});
