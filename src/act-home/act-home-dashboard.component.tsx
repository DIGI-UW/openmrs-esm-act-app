import React from 'react';
import { useTranslation } from 'react-i18next';
import { Layer, Tile } from '@carbon/react';
import { ExtensionSlot, HomePictogram, useAssignedExtensions } from '@openmrs/esm-framework';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import { actHomeWidgetsSlot } from './act-home.meta';
import styles from './act-home.scss';

export default function ActHomeDashboard() {
  const { t } = useTranslation();
  const widgets = useAssignedExtensions(actHomeWidgetsSlot);

  return (
    <>
      <ActPageHeader title={t('actHome', 'ACT home')} illustration={<HomePictogram />} />
      <div className={styles.dashboard}>
        {widgets.length ? (
          <ExtensionSlot name={actHomeWidgetsSlot} className={styles.widgets} />
        ) : (
          <Layer>
            <Tile className={styles.message}>
              {t('noActHomeWidgets', 'No widgets have been added to ACT home yet.')}
            </Tile>
          </Layer>
        )}
      </div>
    </>
  );
}
