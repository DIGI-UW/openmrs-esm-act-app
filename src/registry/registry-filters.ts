import { useEffect, useState } from 'react';
import { type ReportRow } from '../reports/report-dataset.resource';

export interface RegistryFilters {
  status: string;
  cardiac: string;
  primaryCare: string;
  category: string;
  q: string;
}

const keys: Array<keyof RegistryFilters> = ['status', 'cardiac', 'primaryCare', 'category', 'q'];

function fromUrl(): RegistryFilters {
  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(keys.map((key) => [key, params.get(key) ?? ''])) as unknown as RegistryFilters;
}

/** The registry's filters, kept in the page's URL so a view can be bookmarked. */
export function useRegistryFilters() {
  const [filters, setFilters] = useState(fromUrl);

  // The URL follows the filters a moment after typing stops, as each write reroutes every single-spa app.
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      keys.forEach((key) => (filters[key] ? params.set(key, filters[key]) : params.delete(key)));
      const url = `${window.location.pathname}${params.size ? `?${params}` : ''}`;
      if (url !== `${window.location.pathname}${window.location.search}`) {
        window.history.replaceState(window.history.state, '', url);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [filters]);

  // Following the Registry link again resets its URL, and with it the filters.
  useEffect(() => {
    // Other apps' URL changes reach here too; filters that are unchanged keep the page where it is.
    const reread = () =>
      setFilters((current) => {
        const next = fromUrl();
        return keys.every((key) => current[key] === next[key]) ? current : next;
      });
    window.addEventListener('popstate', reread);
    return () => window.removeEventListener('popstate', reread);
  }, []);

  const update = (change: Partial<RegistryFilters>) => setFilters((current) => ({ ...current, ...change }));
  return [filters, update] as const;
}

export function filterRegistry(rows: Array<ReportRow>, filters: RegistryFilters) {
  const q = filters.q.trim().toLowerCase();
  return rows.filter(
    (row) =>
      (!filters.status || row.enrollment_status === filters.status) &&
      (!filters.cardiac || row.cardiac_clinic === filters.cardiac) &&
      (!filters.primaryCare || row.primary_care_clinic === filters.primaryCare) &&
      (!filters.category || row.diagnosis_category === filters.category) &&
      (!q ||
        [row.full_name, row.rhd_id].some((value) =>
          String(value ?? '')
            .toLowerCase()
            .includes(q),
        )),
  );
}

/** The distinct values a column takes, sorted, for a filter's options. */
export function distinctValues(rows: Array<ReportRow>, column: string) {
  return [
    ...new Set(
      rows
        .map((row) => row[column])
        .filter(Boolean)
        .map(String),
    ),
  ].sort();
}
