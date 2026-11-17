import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Tile } from '@carbon/react';
import { ArrowRight, ChevronDown, ChevronUp } from '@carbon/react/icons';
import { ConfigurableLink } from '@openmrs/esm-framework';
import styles from './act-home-card.scss';

/**
 * A home page widget's frame, on ACT home or Home: its title, then on the right a tag and a link to the full screen when
 * given, then its content. Given onToggle, it can be collapsed to its title; collapsed, its content is hidden, not
 * removed, so what it reports elsewhere stays.
 */
export function ActHomeCard({
  title,
  tag,
  link,
  collapsed,
  onToggle,
  children,
}: {
  title: string;
  tag?: React.ReactNode;
  link?: { label: string; to: string };
  collapsed?: boolean;
  onToggle?: () => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
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
          {onToggle && (
            <Button
              kind="ghost"
              size="sm"
              hasIconOnly
              renderIcon={collapsed ? ChevronDown : ChevronUp}
              iconDescription={
                collapsed
                  ? t('expandSection', 'Expand {{section}}', { section: title })
                  : t('collapseSection', 'Collapse {{section}}', { section: title })
              }
              tooltipPosition="left"
              aria-expanded={!collapsed}
              onClick={onToggle}
            />
          )}
        </div>
      </div>
      <div hidden={collapsed} data-collapsible-body="">
        {children}
      </div>
    </Tile>
  );
}
