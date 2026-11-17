import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

/** The levels and types ACT names, translated; a clinic's own value shows as written. */
export function useClinicText() {
  const { t } = useTranslation();
  return useMemo(() => {
    const levels: Record<string, string> = {
      Tertiary: t('tertiary', 'Tertiary'),
      District: t('district', 'District'),
      Community: t('community', 'Community'),
    };
    const types: Record<string, string> = {
      Public: t('public', 'Public'),
      'Private Not-For-Profit': t('privateNotForProfit', 'Private Not-For-Profit'),
      'Private For-Profit': t('privateForProfit', 'Private For-Profit'),
    };
    return { levelText: (level: string) => levels[level] ?? level, typeText: (type: string) => types[type] ?? type };
  }, [t]);
}
