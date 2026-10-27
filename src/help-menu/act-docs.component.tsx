import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@carbon/react';
import { ArrowUpRight } from '@carbon/react/icons';
import { useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import styles from './help-menu.scss';

export default function ActDocs() {
  const { t } = useTranslation();
  const { helpMenu } = useConfig<Config>();
  if (!helpMenu.docsUrl) {
    return null;
  }
  return (
    <Link
      className={styles.helpButton}
      href={helpMenu.docsUrl}
      target="_blank"
      rel="noopener noreferrer"
      renderIcon={ArrowUpRight}
    >
      {t('docs', 'Docs')}
    </Link>
  );
}
