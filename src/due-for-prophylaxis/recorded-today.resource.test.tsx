import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { type ReportRow } from '../reports/report-dataset.resource';
import { recordedToday, useRecordedToday } from './recorded-today.resource';

const row = (patient: string, fields: Partial<ReportRow>): ReportRow => ({ patient_uuid: patient, ...fields });

describe('recordedToday', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 6, 10, 30));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("takes the report's recorded_today column, which judges today on the server's clock, as its statuses are", () => {
    expect(recordedToday(row('a', { recorded_today: 1, last_given: '2026-10-05T00:00:00.000+0000' }))).toBe(true);
    expect(recordedToday(row('b', { recorded_today: 0, last_given: '2026-10-06T00:00:00.000+0000' }))).toBe(false);
    expect(recordedToday(row('c', { recorded_today: '1' }))).toBe(true);
  });

  it('falls back to the last dose falling on today, for a report without the column', () => {
    expect(recordedToday(row('a', { last_given: '2026-10-06T00:00:00.000+0000' }))).toBe(true);
    expect(recordedToday(row('b', { last_given: [2026, 10, 6] }))).toBe(true);
    expect(recordedToday(row('c', { last_given: '2026-10-05T00:00:00.000+0000' }))).toBe(false);
    expect(recordedToday(row('d', { last_given: null }))).toBe(false);
    expect(recordedToday(row('e', {}))).toBe(false);
  });

  it('reads the fallback on the given day', () => {
    expect(recordedToday(row('a', { last_given: '2026-10-05T00:00:00.000+0000' }), new Date(2026, 9, 5))).toBe(true);
  });
});

describe('useRecordedToday', () => {
  it('collects the patients recorded today from the rows, with no request', () => {
    const rows = [
      row('patient-today', { recorded_today: 1 }),
      row('patient-due', { recorded_today: 0 }),
      row('patient-fallback', { last_given: new Date().toISOString() }),
    ];

    const { result } = renderHook(() => useRecordedToday(rows));

    expect([...result.current.recorded].sort()).toEqual(['patient-fallback', 'patient-today']);
  });

  it('has nobody when nothing is listed', () => {
    const { result } = renderHook(() => useRecordedToday([]));

    expect(result.current.recorded.size).toBe(0);
  });
});
