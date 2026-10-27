import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@carbon/react';
import { ArrowUpRight } from '@carbon/react/icons';
import { useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import styles from './help-menu.scss';

export default function ActContact() {
  const { t } = useTranslation();
  const { helpMenu } = useConfig<Config>();
  if (!helpMenu.contactUrl) {
    return null;
  }
  return (
    <Link className={styles.helpButton} href={helpMenu.contactUrl} renderIcon={ArrowUpRight}>
      {t('contactUs', 'Contact us')}
    </Link>
  );
}
