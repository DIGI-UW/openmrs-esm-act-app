import { describe, expect, it } from 'vitest';
import { cascadeShares, registrantCounts, waitlistCounts } from './dashboard-counts';

describe('dashboard counts', () => {
  it('reads status, and the active registrants by sex, age band in order and disease, from the registrants report', () => {
    const counts = registrantCounts([
      { breakdown: 'status', label: 'Active', patients: 3 },
      { breakdown: 'status', label: 'Lost to follow-up', patients: 2 },
      { breakdown: 'sex', label: 'Male', patients: 1 },
      { breakdown: 'sex', label: 'Female', patients: 2 },
      { breakdown: 'age', label: 'Age unknown', patients: 1 },
      { breakdown: 'age', label: '20-39', patients: 1 },
      { breakdown: 'age', label: '0-9', patients: 1 },
      { breakdown: 'disease', label: 'RHD, details not recorded', patients: 1 },
      { breakdown: 'disease', label: 'RHD A', patients: 2 },
    ]);

    expect(counts.registered).toBe(5);
    expect(counts.active).toBe(3);
    expect(counts.status).toEqual([
      { label: 'Active', value: 3 },
      { label: 'Lost to follow-up', value: 2 },
    ]);
    expect(counts.sex.map(({ label }) => label)).toEqual(['Female', 'Male']);
    expect(counts.age.map(({ label }) => label)).toEqual(['0-9', '20-39', 'Age unknown']);
    expect(counts.category.map(({ label }) => label)).toEqual(['RHD A', 'RHD, details not recorded']);
  });

  it('counts nobody active when the report has no Active row', () => {
    expect(registrantCounts([]).active).toBe(0);
    expect(registrantCounts([]).registered).toBe(0);
  });

  it('reads the open recommendations by procedure and urgency, the patients waiting and the procedures performed', () => {
    const counts = waitlistCounts([
      {
        breakdown: 'open',
        procedure: 'Mitral valve repair/replacement',
        urgency: '2: urgent',
        patients: 1,
        recommendations: 1,
      },
      {
        breakdown: 'open',
        procedure: 'Mitral valve repair/replacement',
        urgency: '10: later',
        patients: 1,
        recommendations: 2,
      },
      {
        breakdown: 'open',
        procedure: 'Aortic valve repair/replacement',
        urgency: '1: emergent',
        patients: 1,
        recommendations: 1,
      },
      { breakdown: 'total', procedure: 'All', urgency: null, patients: 2, recommendations: 4 },
      {
        breakdown: 'performed',
        procedure: 'Mitral balloon valvuloplasty',
        urgency: null,
        patients: 3,
        recommendations: 4,
      },
      { breakdown: 'performed', procedure: 'Surgery', urgency: null, patients: 1, recommendations: 1 },
    ]);

    expect(counts.urgencies).toEqual(['1: emergent', '2: urgent', '10: later']);
    expect(counts.rows).toEqual([
      { procedure: 'Aortic valve repair/replacement', counts: [1, 0, 0] },
      { procedure: 'Mitral valve repair/replacement', counts: [0, 1, 2] },
    ]);
    expect(counts.total).toBe(4);
    expect(counts.patients).toBe(2);
    expect(counts.performed).toEqual({ bmv: 4, surgery: 1 });
  });

  it('gives each step its share of the step before, or of the step named for it', () => {
    const steps = [
      { label: 'Initiated', value: 10 },
      { label: 'Covered today', value: 5 },
      { label: 'Adherent', value: 4 },
    ];

    expect(cascadeShares(steps).map(({ share }) => share)).toEqual([null, 50, 80]);
    expect(cascadeShares(steps, { Adherent: 'Initiated' }).map(({ share }) => share)).toEqual([null, 50, 40]);
  });
});
