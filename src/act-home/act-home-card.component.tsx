import React from 'react';
import { Tile } from '@carbon/react';
import { ConfigurableLink } from '@openmrs/esm-framework';
import styles from './act-home-card.scss';

/** An ACT home widget's frame: its title, a link to the full screen on the right when it has one, then its content. */
export function ActHomeCard({
  title,
  link,
  children,
}: {
  title: string;
  link?: { label: string; to: string };
  children: React.ReactNode;
}) {
  return (
    <Tile className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        {link && (
          <ConfigurableLink to={link.to} className={styles.link}>
            {link.label}
          </ConfigurableLink>
        )}
      </div>
      {children}
    </Tile>
  );
}
