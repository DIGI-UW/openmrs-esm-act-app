import React from 'react';
import { SkeletonText, Tile } from '@carbon/react';
import styles from './figure-tiles.scss';

interface FigureBase {
  /** Unique within the row. */
  key: string;
  label: string;
  value: React.ReactNode;
  caption?: string;
  tone?: 'alert' | 'info' | 'success';
  loading?: boolean;
}

/** A figure is shown, or is a toggle that filters what the page lists, named by `action` for screen readers. */
type Toggle = FigureBase & { onPress: () => void; pressed: boolean; action: string };
export type Figure = (FigureBase & { onPress?: undefined }) | Toggle;

const isToggle = (figure: Figure): figure is Toggle => Boolean(figure.onPress) && !figure.loading;

/** ACT's summary figures, so every page's tiles look alike: change the design here, not in a page. */
export function FigureTiles({ figures, columns, testId }: { figures: Array<Figure>; columns: 3 | 4; testId: string }) {
  return (
    <div className={`${styles.figures} ${columns === 4 ? styles.four : styles.three}`}>
      {figures.map((figure) => {
        const toggle = isToggle(figure) ? figure : null;
        const tile = (
          <Tile
            className={`${styles.figure} ${toggle?.pressed ? styles.pressed : ''}`}
            data-testid={toggle ? undefined : testId}
          >
            <span className={styles.label}>{figure.label}</span>
            {figure.loading ? (
              <SkeletonText heading width="40%" />
            ) : (
              <span className={`${styles.value} ${figure.tone ? styles[figure.tone] : ''}`}>{figure.value}</span>
            )}
            {figure.caption && <span className={styles.caption}>{figure.caption}</span>}
          </Tile>
        );
        return toggle ? (
          <button
            key={figure.key}
            type="button"
            className={styles.toggle}
            aria-label={toggle.action}
            aria-pressed={toggle.pressed}
            data-testid={testId}
            onClick={toggle.onPress}
          >
            {tile}
          </button>
        ) : (
          <React.Fragment key={figure.key}>{tile}</React.Fragment>
        );
      })}
    </div>
  );
}
