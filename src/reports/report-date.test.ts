import { describe, expect, it } from 'vitest';
import { parseReportDate } from './report-date';

describe('parseReportDate', () => {
  it('reads an ISO string as its calendar day, whatever its offset', () => {
    expect(parseReportDate('2026-10-15T00:00:00.000+0000')).toEqual(new Date(2026, 9, 15));
    expect(parseReportDate('2026-10-15T23:00:00.000-0500')).toEqual(new Date(2026, 9, 15));
  });

  it('reads a Java-style array, whose month is 1-based', () => {
    expect(parseReportDate([2026, 5, 1, 9, 0])).toEqual(new Date(2026, 4, 1));
  });

  it('gives null for an empty or unreadable value', () => {
    expect(parseReportDate(null)).toBeNull();
    expect(parseReportDate('soon')).toBeNull();
  });
});
