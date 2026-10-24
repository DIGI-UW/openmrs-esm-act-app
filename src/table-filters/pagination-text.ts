import { useTranslation } from 'react-i18next';

/** The words of a Carbon Pagination, which it would otherwise show in English. */
export function usePaginationText() {
  const { t } = useTranslation();
  return {
    backwardText: t('previousPage', 'Previous page'),
    forwardText: t('nextPage', 'Next page'),
    itemsPerPageText: t('itemsPerPage', 'Items per page:'),
    pageNumberText: t('pageNumber', 'Page number'),
    itemRangeText: (min: number, max: number, total: number) =>
      t('itemRange', '{{min}}–{{max}} of {{count}} items', { min, max, count: total }),
    pageRangeText: (_current: number, total: number) => t('pageRange', 'of {{count}} pages', { count: total }),
  };
}
