import { useEffect, useState } from 'react';
import { usePagination } from '@openmrs/esm-framework';

const pageSizes = [25, 50, 100];

/** A filtered table's current page of rows, and the props for its Carbon Pagination. */
export function usePagedRows<T>(rows: Array<T>, filters: object) {
  const [pageSize, setPageSize] = useState(pageSizes[0]);
  const { results, currentPage, goTo } = usePagination(rows, pageSize);
  // A change of filters, chosen on the page or by following its nav link again, starts from the first page.
  useEffect(() => goTo(1), [filters, goTo]);
  const paginationProps = {
    page: currentPage,
    pageSize,
    pageSizes,
    totalItems: rows.length,
    onChange: ({ page, pageSize: size }: { page: number; pageSize: number }) => {
      setPageSize(size);
      goTo(page);
    },
  };
  return { results, paginationProps };
}
