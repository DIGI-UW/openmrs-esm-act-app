import React from 'react';
import { useTranslation } from 'react-i18next';
import { InlineNotification, SkeletonText } from '@carbon/react';
import { ConfigurableLink } from '@openmrs/esm-framework';
import { ScreenAccess } from '../access/screen-access.component';
import { ActHomeCard } from './act-home-card.component';
import { type RhdFlagList, useRhdFlagLists } from '../rhd-flags/rhd-flag-lists.resource';
import { worklistsUrl } from '../worklists/worklists.meta';
import styles from './worklist-tiles.scss';

export function riskFirst(lists: Array<RhdFlagList>) {
  return [...lists.filter((l) => l.priority === 'risk'), ...lists.filter((l) => l.priority !== 'risk')];
}

function WorklistTileContent({ list, selected = false }: { list: RhdFlagList; selected?: boolean }) {
  return (
    <div
      data-testid="worklist-tile"
      data-priority={list.priority}
      className={selected ? `${styles.tile} ${styles.selected}` : styles.tile}
    >
      <span className={styles.count}>{list.memberCount}</span>
      <span className={styles.name}>{list.flagName}</span>
    </div>
  );
}

export function WorklistTileGrid({ children }: { children: React.ReactNode }) {
  return <div className={styles.tiles}>{children}</div>;
}

/** A tile that chooses its list on the page it is on. */
export function WorklistChoice({
  list,
  selected,
  onSelect,
}: {
  list: RhdFlagList;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button type="button" className={styles.choice} aria-pressed={selected} onClick={onSelect}>
      <WorklistTileContent list={list} selected={selected} />
    </button>
  );
}

function WorklistTile({ list }: { list: RhdFlagList }) {
  return list.cohortUuid ? (
    <ConfigurableLink to={worklistsUrl(list.flagName)} className={styles.link}>
      <WorklistTileContent list={list} />
    </ConfigurableLink>
  ) : (
    <WorklistTileContent list={list} />
  );
}

function Worklists() {
  const { t } = useTranslation();
  const { lists, isLoading, error } = useRhdFlagLists();

  return (
    <ActHomeCard title={t('worklists', 'Worklists')} link={{ label: t('allLists', 'All lists'), to: worklistsUrl() }}>
      {error ? (
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title={t('couldNotLoadWorklists', 'Could not load the worklists')}
        />
      ) : isLoading ? (
        <div data-testid="worklists-loading">
          <SkeletonText paragraph lineCount={3} />
        </div>
      ) : lists.length === 0 ? (
        <p className={styles.empty}>{t('noRhdFlagLists', 'No RHD flag lists found')}</p>
      ) : (
        <WorklistTileGrid>
          {riskFirst(lists).map((list) => (
            <WorklistTile key={list.flagName} list={list} />
          ))}
        </WorklistTileGrid>
      )}
    </ActHomeCard>
  );
}

export default function WorklistTiles() {
  return (
    <ScreenAccess screen="home">
      <Worklists />
    </ScreenAccess>
  );
}
