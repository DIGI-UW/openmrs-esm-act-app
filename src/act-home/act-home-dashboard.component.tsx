import React from 'react';
import { useTranslation } from 'react-i18next';
import { Layer, Tile } from '@carbon/react';
import { ExtensionSlot, useAssignedExtensions } from '@openmrs/esm-framework';
import { useScreenAccess } from '../access/screen-access.component';
import { actHomeWidgetsSlot } from './act-home.meta';
import styles from './act-home.scss';

export default function ActHomeDashboard() {
  const { t } = useTranslation();
  const canSeeHome = useScreenAccess('home');
  const widgets = useAssignedExtensions(actHomeWidgetsSlot);

  if (!canSeeHome) {
    return <p className={styles.message}>{t('noAccessToActHome', 'You do not have access to ACT home.')}</p>;
  }

  return (
    <div className={styles.dashboard}>
      <h1 className={styles.title}>{t('actHome', 'ACT home')}</h1>
      {widgets.length ? (
        <ExtensionSlot name={actHomeWidgetsSlot} className={styles.widgets} />
      ) : (
        <Layer>
          <Tile className={styles.message}>{t('noActHomeWidgets', 'No widgets have been added to ACT home yet.')}</Tile>
        </Layer>
      )}
    </div>
  );
}
