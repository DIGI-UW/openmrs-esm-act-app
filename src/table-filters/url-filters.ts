import { useEffect, useRef, useState } from 'react';

/** A screen's opening filters, or 'pending' while they are still being worked out. */
export type FilterDefaults<K extends string> = Partial<Record<K, string>> | 'pending';

function fromUrl<K extends string>(keys: ReadonlyArray<K>) {
  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(keys.map((key) => [key, params.get(key) ?? ''])) as Record<K, string>;
}

const urlHasNone = (keys: ReadonlyArray<string>) => {
  const params = new URLSearchParams(window.location.search);
  return keys.every((key) => !params.has(key));
};

/**
 * A screen's filters, one per key, kept in the page's URL so a view can be bookmarked. A URL with none of the
 * keys opens on the defaults; a defaulted filter set to All is written empty, so a reload keeps All.
 */
export function useUrlFilters<K extends string>(keys: ReadonlyArray<K>, defaults: FilterDefaults<K> = {}) {
  const ready = defaults !== 'pending';
  const withDefaults = (base: Record<K, string>) => (ready ? { ...base, ...defaults } : base);
  const [filters, setFilters] = useState(() => (urlHasNone(keys) ? withDefaults(fromUrl(keys)) : fromUrl(keys)));
  // A ref, not state: applying the defaults must not rerun the URL write.
  const awaitingDefaults = useRef(!ready && urlHasNone(keys));
  const defaultedKeys = ready ? (Object.keys(defaults) as Array<K>) : [];

  useEffect(() => {
    if (ready && awaitingDefaults.current) {
      awaitingDefaults.current = false;
      setFilters((current) => ({ ...current, ...defaults }));
    }
    // The defaults' contents, not their identity, decide; they settle once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // The URL follows the filters a moment after typing stops, as each write reroutes every single-spa app.
  useEffect(() => {
    // Until the defaults are known, an empty filter cannot tell All from unset, so the URL is left alone.
    if (!ready) {
      return;
    }
    const timer = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      keys.forEach((key) => {
        if (filters[key]) {
          params.set(key, filters[key]);
        } else if (defaultedKeys.includes(key)) {
          params.set(key, '');
        } else {
          params.delete(key);
        }
      });
      const url = `${window.location.pathname}${params.size ? `?${params}` : ''}`;
      if (url !== `${window.location.pathname}${window.location.search}`) {
        window.history.replaceState(window.history.state, '', url);
      }
    }, 300);
    return () => clearTimeout(timer);
    // defaultedKeys is rebuilt each render; ready says when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, keys, ready]);

  // Following the screen's nav link again resets its URL, and with it the filters.
  useEffect(() => {
    // Other apps' URL changes reach here too; filters that are unchanged keep the page where it is.
    const reread = () =>
      setFilters((current) => {
        const next = urlHasNone(keys) ? withDefaults(fromUrl(keys)) : fromUrl(keys);
        return keys.every((key) => current[key] === next[key]) ? current : next;
      });
    window.addEventListener('popstate', reread);
    return () => window.removeEventListener('popstate', reread);
    // withDefaults is rebuilt each render; ready says when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys, ready]);

  const update = (change: Partial<Record<K, string>>) => setFilters((current) => ({ ...current, ...change }));
  // Pending tells a screen to wait, as a filter picked before the defaults arrive would be overwritten.
  return [filters, update, !ready] as const;
}
