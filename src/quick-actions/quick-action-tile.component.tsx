import React from 'react';
import { type Add } from '@carbon/react/icons';
import { ConfigurableLink } from '@openmrs/esm-framework';
import styles from './quick-actions.scss';

export interface QuickActionTileProps {
  label: string;
  Icon: typeof Add;
  subtitle?: string;
  /** Where a link tile leads; without it, the tile is a button. */
  to?: string;
  onClick?: () => void;
  expanded?: boolean;
}

/** One quick action, as every home draws it: an icon over its label and subtitle, as a link or a button. */
export function QuickActionTile({ label, Icon, subtitle, to, onClick, expanded }: QuickActionTileProps) {
  const content = (
    <>
      <span className={styles.icon}>
        <Icon size={20} />
      </span>
      <span className={styles.label}>{label}</span>
      {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
    </>
  );
  if (to) {
    return (
      <ConfigurableLink to={to} className={styles.tile}>
        {content}
      </ConfigurableLink>
    );
  }
  return (
    <button type="button" className={styles.tile} onClick={onClick} aria-expanded={expanded}>
      {content}
    </button>
  );
}
