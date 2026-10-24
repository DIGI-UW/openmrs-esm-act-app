import { useTranslation } from 'react-i18next';
import { getCoreTranslation } from '@openmrs/esm-framework';

export function usePaginationText() {
  const { t } = useTranslation();
  return {
    backwardText: t('previousPage', 'Previous page'),
    forwardText: t('nextPage', 'Next page'),
    itemsPerPageText: t('itemsPerPage', 'Items per page:'),
    itemRangeText: (min: number, max: number, total: number) =>
      t('itemRange', '{{min}}–{{max}} of {{count}} items', { min, max, count: total }),
    pageRangeText: (_current: number, total: number) =>
      getCoreTranslation('paginationOfPages', undefined, { count: total }),
  };
}
