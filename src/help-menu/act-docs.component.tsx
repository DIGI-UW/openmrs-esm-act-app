import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@carbon/react';
import { ArrowUpRight } from '@carbon/react/icons';
import styles from './help-menu.scss';

export default function ActDocs() {
  const { t } = useTranslation();
  return (
    <Link className={styles.helpButton} renderIcon={ArrowUpRight}>
      {t('docs', 'Docs')}
    </Link>
  );
}
