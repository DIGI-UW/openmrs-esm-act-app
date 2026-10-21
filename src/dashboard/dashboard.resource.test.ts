import { describe, expect, it } from 'vitest';
import { careCharts, registrantCharts, screeningCascadeSteps, screeningCharts } from './dashboard.resource';

const rhd = 'Rheumatic Heart Disease/Rheumatic Fever';

describe('registrantCharts', () => {
  const rows = [
    { status: 'Active', age_band: '10-19', sex: 'F', category: rhd, details: 'RHD B', patients: 3 },
    { status: 'Active', age_band: '20-39', sex: 'M', category: rhd, details: null, patients: 1 },
    { status: 'Active', age_band: null, sex: 'F', category: 'Congenital heart disease', details: null, patients: 2 },
    { status: 'Active', age_band: '0-9', sex: 'M', category: null, details: null, patients: 1 },
    { status: 'Lost to follow-up', age_band: '40+', sex: 'F', category: rhd, details: 'RHD A', patients: 4 },
  ];

  it('counts every patient by status, Active first, and the active ones by age, sex and disease', () => {
    const charts = registrantCharts(rows);

    expect(charts.total).toBe(11);
    expect(charts.active).toBe(7);
    expect(charts.status).toEqual([
      { group: 'Active', key: 'Active', value: 7 },
      { group: 'Lost to follow-up', key: 'Lost to follow-up', value: 4 },
    ]);
    expect(charts.age).toEqual([
      { key: '0-9', value: 1 },
      { key: '10-19', value: 3 },
      { key: '20-39', value: 1 },
      { key: '40+', value: 0 },
      { key: 'Not recorded', value: 2 },
    ]);
    expect(charts.sex).toEqual([
      { key: 'Female', value: 5 },
      { key: 'Male', value: 2 },
    ]);
    // RHD by its details, as ACT 2.0's disease chart; RHD without details and no diagnosis as they are.
    expect(charts.disease).toEqual([
      { key: 'RHD B', value: 3 },
      { key: rhd, value: 1 },
      { key: 'Congenital heart disease', value: 2 },
      { key: 'None', value: 1 },
    ]);
  });

  it('narrows the demographics to a category, leaving the status counts whole', () => {
    const charts = registrantCharts(rows, 'Congenital heart disease');

    expect(charts.total).toBe(11);
    expect(charts.sex).toEqual([{ key: 'Female', value: 2 }]);
    expect(charts.categories).toEqual(['Congenital heart disease', rhd]);
  });
});

describe('careCharts', () => {
  it('reads the waitlist by procedure and urgency, procedures performed and each Yes, then No', () => {
    const charts = careCharts([
      { measure: 'waitlist', label: 'Mitral valve surgery', grouping: '2: urgent (60 days/2 months)', patients: 2 },
      { measure: 'waitlist', label: 'Other', grouping: null, patients: 1 },
      { measure: 'performed', label: 'Mitral balloon valvuloplasty', grouping: null, patients: 1 },
      { measure: 'performed', label: 'All procedures', grouping: null, patients: 4 },
      { measure: 'medicalOptimisation', label: 'Retained in care', grouping: 'No', patients: 2 },
      { measure: 'medicalOptimisation', label: 'Retained in care', grouping: 'Yes', patients: 5 },
      { measure: 'medicalOptimisation', label: 'INR within 3 months', grouping: 'No', patients: 1 },
    ]);

    expect(charts.waitlist).toEqual([
      { group: '2: urgent (60 days/2 months)', key: 'Mitral valve surgery', value: 2 },
      { group: 'Not recorded', key: 'Other', value: 1 },
    ]);
    expect(charts.waitlistTotal).toBe(3);
    expect(charts.bmvPerformed).toBe(1);
    expect(charts.proceduresPerformed).toBe(4);
    expect(charts.optimisation).toEqual([
      { group: 'Yes', key: 'Retained in care', value: 5 },
      { group: 'No', key: 'Retained in care', value: 2 },
    ]);
    expect(charts.inr).toEqual([{ group: 'No', key: 'INR within 3 months', value: 1 }]);
  });

  it('reads no rows as nothing waiting or performed', () => {
    expect(careCharts([])).toMatchObject({ waitlistTotal: 0, bmvPerformed: 0, proceduresPerformed: 0, inr: [] });
  });
});

describe('screeningCascadeSteps', () => {
  it("gives ACT 2.0's three bars, each a share of the bar before", () => {
    expect(
      screeningCascadeSteps([
        { step_order: 1, step: 'Active', patients: 9 },
        { step_order: 2, step: 'Confirmatory Diagnosis', patients: 4 },
        { step_order: 3, step: 'Diagnosed', patients: 3 },
        { step_order: 4, step: 'Heart Disease', patients: 0 },
      ]),
    ).toEqual([
      { step: 'Confirmatory Diagnosis', value: 4, share: null },
      { step: 'Diagnosed', value: 3, share: 75 },
      { step: 'Heart Disease', value: 0, share: 0 },
    ]);
  });

  it('gives no share after a step of none', () => {
    expect(screeningCascadeSteps([]).map(({ share }) => share)).toEqual([null, null, null]);
  });
});

describe('screeningCharts', () => {
  it('totals the patients, the share female, Screen +, the age groups and how each case was detected', () => {
    const charts = screeningCharts([
      { screen_positive: 'Yes', detected_by: 'School', age_band: '10-19', sex: 'F', patients: 3 },
      { screen_positive: 'No', detected_by: 'Other', age_band: '20+', sex: 'M', patients: 1 },
      { screen_positive: null, detected_by: null, age_band: null, sex: 'F', patients: 1 },
    ]);

    expect(charts.total).toBe(5);
    expect(charts.percentFemale).toBe(80);
    expect(charts.screenPositive).toEqual([
      { key: 'Yes', value: 3 },
      { key: 'No', value: 1 },
      { key: 'Not recorded', value: 1 },
    ]);
    expect(charts.age).toEqual([
      { key: 'Children (0-9)', value: 0 },
      { key: 'Adolescents (10-19)', value: 3 },
      { key: 'Adults (20+)', value: 1 },
      { key: 'Not recorded', value: 1 },
    ]);
    expect(charts.detectedBy.map(({ key, value }) => [key, value])).toEqual([
      ['School', 3],
      ['Community', 0],
      ['Facility', 0],
      ['Other', 1],
      ['Not recorded', 1],
    ]);
  });

  it('gives no share female of no one', () => {
    expect(screeningCharts([]).percentFemale).toBeNull();
  });
});
