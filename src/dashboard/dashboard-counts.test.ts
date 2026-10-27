import { describe, expect, it } from 'vitest';
import { cascadeShares, registrantCounts, shares, waitlistCounts } from './dashboard-counts';

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

  it('rounds shares by largest remainder so they add up to 100, where ACT 2.0 truncated them to 98', () => {
    // The design's settings: 4,624 school, 1,537 community, 679 health facility of 6,840.
    expect(shares([4624, 1537, 679])).toEqual([68, 22, 10]);
    // Truncating gives 33, 33, 33; the earlier value takes the point left over.
    expect(shares([1, 1, 1])).toEqual([34, 33, 33]);
    expect(shares([2, 1, 1, 1, 1, 1, 1])).toEqual([25, 13, 13, 13, 12, 12, 12]);
    expect(shares([2, 1, 1, 1, 1, 1, 1]).reduce((sum, share) => sum + share, 0)).toBe(100);
    expect(shares([0, 0])).toEqual([0, 0]);
    expect(shares([5, 0])).toEqual([100, 0]);
  });
});
