import dayjs from 'dayjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clinicClock, clinicToday, setClinicTimeZone } from './clinic-clock';

describe('clinicClock', () => {
  afterEach(() => {
    setClinicTimeZone('UTC');
    vi.useRealTimers();
  });

  it("reads Kampala's date while UTC is still on the day before", () => {
    setClinicTimeZone('Africa/Kampala');
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-10T22:30:00Z'));
    expect(clinicToday()).toBe('2026-11-11');
    expect(dayjs(clinicClock()).format('HH:mm')).toBe('01:30');
  });

  it('follows the configured zone', () => {
    setClinicTimeZone('America/Los_Angeles');
    expect(dayjs(clinicClock(new Date('2026-11-11T03:30:00Z'))).format('YYYY-MM-DD HH:mm')).toBe('2026-11-10 19:30');
  });
});
