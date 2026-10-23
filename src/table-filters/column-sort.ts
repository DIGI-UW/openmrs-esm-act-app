export interface ColumnSort<K extends string = string> {
  key: K;
  direction: 'ASC' | 'DESC';
}

export type SortValue = string | number | null;

/** Carbon's header cycle: ascending, then descending, then the table's own order. */
export function nextSort<K extends string>(current: ColumnSort<K> | null, key: K): ColumnSort<K> | null {
  if (current?.key !== key) {
    return { key, direction: 'ASC' };
  }
  return current.direction === 'ASC' ? { key, direction: 'DESC' } : null;
}

/** The items in the chosen order, those without a value last either way; no sort keeps the given order. */
export function sortItems<T, K extends string>(
  items: Array<T>,
  sort: ColumnSort<K> | null,
  value: (item: T, key: K) => SortValue,
) {
  if (!sort) {
    return items;
  }
  const sign = sort.direction === 'ASC' ? 1 : -1;
  return [...items].sort((a, b) => {
    const [x, y] = [value(a, sort.key), value(b, sort.key)];
    if (x == null || y == null) {
      return Number(x == null) - Number(y == null);
    }
    return sign * (typeof x === 'string' ? x.localeCompare(String(y), undefined, { numeric: true }) : x - Number(y));
  });
}

/** The props that make a Carbon table header sort this table's rows by `key`. */
export function sortHeaderProps<K extends string>(
  sort: ColumnSort<K> | null,
  key: K,
  onSort: (sort: ColumnSort<K> | null) => void,
) {
  return {
    isSortable: true,
    sortDirection: sort?.key === key ? sort.direction : ('NONE' as const),
    onClick: () => onSort(nextSort(sort, key)),
  };
}
