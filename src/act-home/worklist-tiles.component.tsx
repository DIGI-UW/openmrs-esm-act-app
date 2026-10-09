import React from 'react';
import { useTranslation } from 'react-i18next';
import { Extension, ExtensionSlot } from '@openmrs/esm-framework';
import { type WorklistState } from '../worklists/worklist.component';
import { worklistsSlot, worklistsUrl } from '../worklists/worklists.meta';
import { ActHomeCard } from './act-home-card.component';
import styles from './worklist-tiles.scss';

/** ACT home's Worklists: a tile for each worklist, each opening the Worklists page on its list. */
export default function WorklistTiles() {
  const { t } = useTranslation();
  return (
    <ActHomeCard title={t('worklists', 'Worklists')} link={{ label: t('allLists', 'All lists'), to: worklistsUrl() }}>
      <ExtensionSlot name={worklistsSlot} className={styles.tiles}>
        {(worklist) => <Extension state={{ view: 'tile', to: worklistsUrl(worklist.id) } satisfies WorklistState} />}
      </ExtensionSlot>
    </ActHomeCard>
  );
}
