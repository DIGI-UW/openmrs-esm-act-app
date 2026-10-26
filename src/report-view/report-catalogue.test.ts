import { describe, expect, it } from 'vitest';
import { formatDate } from '@openmrs/esm-framework';
import { type ClinicLimit } from '../clinic-limit';
import {
  cellText,
  columnHeader,
  limitToClinics,
  matchesSearch,
  reportsFor,
  sortValue,
  type CatalogueEntry,
} from './report-catalogue';

const visits: CatalogueEntry = {
  id: 'visits',
  report: 'v',
  label: 'Visits',
  description: '',
  clinicColumn: 'location',
};
const unscoped: CatalogueEntry = { id: 'other', report: 'o', label: 'Other', description: '', clinicColumn: '' };
const catalogue = [visits, unscoped];
const none: ClinicLimit = { status: 'none' };
const gulu: ClinicLimit = { status: 'ready', uuids: ['g'], names: ['Gulu RRH'] };

describe('reportsFor', () => {
  it('lists every report for a user held to no clinics', () => {
    expect(reportsFor(catalogue, none)).toEqual(catalogue);
  });

  it('leaves out a report that names no clinic column for a user held to clinics, which it could not hold', () => {
    expect(reportsFor(catalogue, gulu)).toEqual([visits]);
  });

  it('lists nothing while the user’s clinics are not yet known', () => {
    expect(reportsFor(catalogue, { status: 'pending' })).toEqual([]);
  });
});

describe('limitToClinics', () => {
  const rows = [{ location: 'Gulu RRH' }, { location: 'Lira RRH' }, { location: null }];

  it('keeps every row for a user held to no clinics', () => {
    expect(limitToClinics(rows, visits, none)).toEqual(rows);
  });

  it('keeps only the rows whose clinic column is one of the user’s clinics', () => {
    expect(limitToClinics(rows, visits, gulu)).toEqual([{ location: 'Gulu RRH' }]);
  });

  it('keeps nothing for a limited user when the report names no clinic column, or the clinics are pending', () => {
    expect(limitToClinics(rows, unscoped, gulu)).toEqual([]);
    expect(limitToClinics(rows, visits, { status: 'pending' })).toEqual([]);
  });
});

describe('cellText', () => {
  it('shows nothing for a missing value, Yes or No for a boolean and a number as it is', () => {
    expect(cellText(null, 'java.lang.String')).toBe('');
    expect(cellText(true, 'java.lang.Boolean')).toBe('Yes');
    expect(cellText(false, 'java.lang.Boolean')).toBe('No');
    expect(cellText(42, 'java.lang.Integer')).toBe('42');
  });

  it('shows a date column as a date, the day the report recorded', () => {
    const day = formatDate(new Date(2026, 9, 1), { time: false, noToday: true });
    expect(cellText('2026-10-01T00:00:00.000+0000', 'java.util.Date')).toBe(day);
    expect(cellText([2026, 10, 1], 'java.util.Date')).toBe(day);
    expect(cellText('2026-10-01', 'java.lang.String')).toBe('2026-10-01');
  });

  it('shows a day at midnight as a date although the report types every column Object, and leaves other text alone', () => {
    const day = formatDate(new Date(2026, 9, 23), { time: false, noToday: true });
    expect(cellText('2026-10-23T00:00:00.000+0000', 'java.lang.Object')).toBe(day);
    expect(cellText('2026-10-23T09:30:00.000+0000', 'java.lang.Object')).toBe('2026-10-23T09:30:00.000+0000');
    expect(cellText('2026-10-23', 'java.lang.Object')).toBe('2026-10-23');
    expect(cellText('rhd00001', 'java.lang.Object')).toBe('rhd00001');
  });

  it('sorts such days by the day', () => {
    expect(sortValue('2026-10-23T00:00:00.000+0000', 'java.lang.Object')).toBe(new Date(2026, 9, 23).getTime());
    expect(sortValue('rhd00001', 'java.lang.Object')).toBe('rhd00001');
  });
});

describe('columnHeader', () => {
  it('reads a label that only repeats the column name as words', () => {
    expect(columnHeader({ name: 'encounter_date', label: 'encounter_date', datatype: '' })).toBe('Encounter date');
    expect(columnHeader({ name: 'rhd_id', label: 'ACT ID', datatype: '' })).toBe('ACT ID');
  });
});

describe('matchesSearch', () => {
  const columns = [
    { name: 'rhd_id', label: 'rhd_id', datatype: 'java.lang.String' },
    { name: 'nyha_class', label: 'nyha_class', datatype: 'java.lang.String' },
  ];

  it('matches text in any column, whatever its case, and everything for a blank search', () => {
    const row = { rhd_id: 'rhd00012', nyha_class: 'Class II' };
    expect(matchesSearch(row, columns, 'CLASS ii')).toBe(true);
    expect(matchesSearch(row, columns, '00012')).toBe(true);
    expect(matchesSearch(row, columns, 'nope')).toBe(false);
    expect(matchesSearch(row, columns, '  ')).toBe(true);
  });
});
