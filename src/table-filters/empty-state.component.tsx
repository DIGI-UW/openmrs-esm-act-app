import React from 'react';
import { useTranslation } from 'react-i18next';
import { Layer, Tile } from '@carbon/react';
import { EmptyCardIllustration } from '@openmrs/esm-framework';
import styles from './empty-state.scss';

/** A table with nothing to show yet, as O3's empty card draws it: the illustration and what is missing. */
export function TableEmptyState({ message }: { message: string }) {
  return (
    <Layer>
      <Tile className={styles.tile} data-testid="table-empty-state">
        <EmptyCardIllustration />
        <p className={styles.content}>{message}</p>
      </Tile>
    </Layer>
  );
}

/** A table whose filters match nothing, as O3's Active Visits says so. */
export function FilterEmptyState({ message }: { message: string }) {
  const { t } = useTranslation();
  return (
    <Layer>
      <Tile className={styles.tile} data-testid="filter-empty-state">
        <p className={styles.content}>{message}</p>
        <p className={styles.helper}>{t('checkFilters', 'Check the filters above')}</p>
      </Tile>
    </Layer>
  );
}
