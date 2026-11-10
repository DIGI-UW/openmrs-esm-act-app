import { describe, expect, it } from 'vitest';
import { formatDate, formatDatetime } from './format-date';

describe('formatDate', () => {
  it('writes September with three letters, as every other month', () => {
    expect(formatDate(new Date(2026, 8, 30), { noToday: true, time: false })).toBe('30-Sep-2026');
    expect(formatDate(new Date(2026, 10, 10), { noToday: true, time: false })).toBe('10-Nov-2026');
  });

  it("keeps the framework's options", () => {
    expect(formatDate(new Date(2026, 8, 8), { noToday: true, day: false })).toBe('Sep 2026');
  });
});

describe('formatDatetime', () => {
  it('writes September with three letters before the time', () => {
    expect(formatDatetime(new Date(2026, 8, 30, 14, 5))).toMatch(/^30-Sep-2026, /);
  });
});
