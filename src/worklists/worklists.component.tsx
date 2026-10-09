import React from 'react';
import { useTranslation } from 'react-i18next';
import { Extension, ExtensionSlot, PatientListsPictogram, useAssignedExtensions } from '@openmrs/esm-framework';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import { useUrlFilters } from '../table-filters/url-filters';
import { type WorklistState } from './worklist.component';
import { worklistsSlot } from './worklists.meta';
import styles from './worklists.scss';

const filterKeys = ['list'] as const;

/** The worklists as tiles, the chosen one marked, then its patients. A list in the URL that is not here chooses the first. */
function WorklistsContent() {
  const { t } = useTranslation();
  const worklists = useAssignedExtensions(worklistsSlot);
  const [filters, setFilters] = useUrlFilters(filterKeys);
  const chosen = worklists.find((worklist) => worklist.id === filters.list) ?? worklists[0];

  if (!chosen) {
    return <p className={styles.message}>{t('noWorklists', 'No worklists have been added yet.')}</p>;
  }
  return (
    <>
      <ExtensionSlot name={worklistsSlot} className={styles.tiles}>
        {(worklist) => (
          <Extension
            state={
              {
                view: 'choice',
                selected: worklist.id === chosen.id,
                onSelect: () => setFilters({ list: worklist.id }),
              } satisfies WorklistState
            }
          />
        )}
      </ExtensionSlot>
      <ExtensionSlot
        name={worklistsSlot}
        select={(all) => all.filter((worklist) => worklist.id === chosen.id)}
        state={{ view: 'list' } satisfies WorklistState}
      />
    </>
  );
}

export default function Worklists() {
  const { t } = useTranslation();
  return (
    <>
      <ActPageHeader title={t('worklists', 'Worklists')} illustration={<PatientListsPictogram />} />
      <div className={styles.worklists}>
        <p className={styles.description}>{t('worklistsDescription', 'Patients needing action, by list')}</p>
        <WorklistsContent />
      </div>
    </>
  );
}
