import { openmrsFetch } from '@openmrs/esm-framework';

interface Page<T> {
  results: Array<T>;
  totalCount: number;
}

/** Every page of a REST search, at the page size the server chooses; after the first, the pages load in parallel. */
export async function fetchAll<T>(url: string) {
  const fetchPage = (startIndex: number) =>
    openmrsFetch<Page<T>>(`${url}&totalCount=true&startIndex=${startIndex}`).then(({ data }) => data);
  const first = await fetchPage(0);
  const pageSize = first.results.length;
  const startIndexes = [];
  for (let start = pageSize; pageSize && start < first.totalCount; start += pageSize) {
    startIndexes.push(start);
  }
  const rest = await Promise.all(startIndexes.map(fetchPage));
  return [first, ...rest].flatMap((page) => page.results);
}
