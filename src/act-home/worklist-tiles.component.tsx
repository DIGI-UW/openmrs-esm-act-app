import React from 'react';
import { useTranslation } from 'react-i18next';
import { InlineNotification, SkeletonText } from '@carbon/react';
import { ConfigurableLink } from '@openmrs/esm-framework';
import { ScreenAccess } from '../access/screen-access.component';
import { ActHomeCard } from './act-home-card.component';
import { type RhdFlagList, useRhdFlagLists } from '../rhd-flags/rhd-flag-lists.resource';
import styles from './worklist-tiles.scss';

// A tile opens the registry narrowed to its flag's patients.
const registryUrl = (flagName: string) =>
  '${openmrsSpaBase}/home/act-registry?' + new URLSearchParams({ flag: flagName }).toString();

function WorklistTile({ list }: { list: RhdFlagList }) {
  const content = (
    <div data-testid="worklist-tile" data-priority={list.priority} className={styles.tile}>
      <span className={styles.count}>{list.memberCount}</span>
      <span className={styles.name}>{list.flagName}</span>
    </div>
  );
  return list.cohortUuid ? (
    <ConfigurableLink to={registryUrl(list.flagName)} className={styles.link}>
      {content}
    </ConfigurableLink>
  ) : (
    content
  );
}

function Worklists() {
  const { t } = useTranslation();
  const { lists, isLoading, error } = useRhdFlagLists();
  const riskFirst = [...lists.filter((l) => l.priority === 'risk'), ...lists.filter((l) => l.priority !== 'risk')];

  return (
    <ActHomeCard title={t('worklists', 'Worklists')}>
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
        <div className={styles.tiles}>
          {riskFirst.map((list) => (
            <WorklistTile key={list.flagName} list={list} />
          ))}
        </div>
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
