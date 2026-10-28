import { createContext, useContext, useEffect } from 'react';
import { type Count } from './dashboard-counts';

/** A row of the Dashboard's counts CSV: one count as its section shows it, and the period it counts. */
export interface CountRow {
  section: string;
  group: string;
  label: string;
  count: number;
  period: string;
}

/** The parts of the Dashboard that load their counts apart, in the order the CSV lists them. */
export const csvParts = ['figures', 'rhdScreening', 'registrations'] as const;

export type CsvPart = (typeof csvParts)[number];

/** What a part counts beyond the Dashboard's clinics and date, as its own period, for the download log. */
export type PartFilters = Record<string, string>;

/**
 * Where each part of the Dashboard puts its rows for Download CSV, whether they are still loading, and what they
 * count beyond the Dashboard's filters.
 */
export const CountsCsv = createContext<
  ((part: CsvPart, rows: Array<CountRow>, isLoading: boolean, filters: PartFilters) => void) | null
>(null);

/** Gives the Dashboard's Download CSV this part's rows, and takes them back when the part goes. */
export function useCountsCsv(part: CsvPart, rows: Array<CountRow>, isLoading: boolean, filters: PartFilters = {}) {
  const put = useContext(CountsCsv);
  const key = JSON.stringify([rows, filters]);
  useEffect(() => {
    put?.(part, rows, isLoading, filters);
    // The rows and filters are compared by value, as each render builds them anew.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [put, part, key, isLoading]);
  useEffect(() => () => put?.(part, [], false, {}), [put, part]);
}

/** Rows for counts drawn under one heading. */
export const countRows = (section: string, group: string, counts: Array<Count>, period: string): Array<CountRow> =>
  counts.map(({ label, value, name }) => ({ section, group, label: name ?? label, count: value, period }));
