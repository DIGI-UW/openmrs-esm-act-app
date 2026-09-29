import { useEffect, useState } from 'react';

function fromUrl<K extends string>(keys: ReadonlyArray<K>) {
  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(keys.map((key) => [key, params.get(key) ?? ''])) as Record<K, string>;
}

/** A screen's filters, one per key, kept in the page's URL so a view can be bookmarked. */
export function useUrlFilters<K extends string>(keys: ReadonlyArray<K>) {
  const [filters, setFilters] = useState(() => fromUrl(keys));

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
  }, [filters, keys]);

  // Following the screen's nav link again resets its URL, and with it the filters.
  useEffect(() => {
    // Other apps' URL changes reach here too; filters that are unchanged keep the page where it is.
    const reread = () =>
      setFilters((current) => {
        const next = fromUrl(keys);
        return keys.every((key) => current[key] === next[key]) ? current : next;
      });
    window.addEventListener('popstate', reread);
    return () => window.removeEventListener('popstate', reread);
  }, [keys]);

  const update = (change: Partial<Record<K, string>>) => setFilters((current) => ({ ...current, ...change }));
  return [filters, update] as const;
}
