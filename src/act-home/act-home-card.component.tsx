import React from 'react';
import { Tile } from '@carbon/react';
import { ArrowRight } from '@carbon/react/icons';
import { ConfigurableLink } from '@openmrs/esm-framework';
import styles from './act-home-card.scss';

/** An ACT home widget's frame: its title, then on the right a tag and a link to the full screen when given, then its content. */
export function ActHomeCard({
  title,
  tag,
  link,
  children,
}: {
  title: string;
  tag?: React.ReactNode;
  link?: { label: string; to: string };
  children: React.ReactNode;
}) {
  return (
    <Tile className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        <div className={styles.end}>
          {tag}
          {link && (
            <ConfigurableLink to={link.to} className={styles.link}>
              {link.label}
              <ArrowRight size={16} aria-hidden="true" />
            </ConfigurableLink>
          )}
        </div>
      </div>
      {children}
    </Tile>
  );
}
