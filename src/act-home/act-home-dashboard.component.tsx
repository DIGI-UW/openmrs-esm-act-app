import React from 'react';
import { useTranslation } from 'react-i18next';
import { Layer, Tile } from '@carbon/react';
import { ExtensionSlot, HomePictogram, useAssignedExtensions } from '@openmrs/esm-framework';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import { actHomeWidgetsSlot } from './act-home.meta';
import styles from './act-home.scss';

/** A home page: its header, then the widgets assigned to its slot, or a message while there are none. */
export function HomeDashboard({
  title,
  widgetsSlot,
  emptyMessage,
  headerActions,
}: {
  title: string;
  widgetsSlot: string;
  emptyMessage: string;
  headerActions?: React.ReactNode;
}) {
  const widgets = useAssignedExtensions(widgetsSlot);

  return (
    <>
      <ActPageHeader title={title} illustration={<HomePictogram />} actions={headerActions} />
      <div className={styles.dashboard}>
        {widgets.length ? (
          <ExtensionSlot name={widgetsSlot} className={styles.widgets} />
        ) : (
          <Layer>
            <Tile className={styles.message}>{emptyMessage}</Tile>
          </Layer>
        )}
      </div>
    </>
  );
}

export default function ActHomeDashboard() {
  const { t } = useTranslation();

  return (
    <HomeDashboard
      title={t('actHome', 'ACT home')}
      widgetsSlot={actHomeWidgetsSlot}
      emptyMessage={t('noActHomeWidgets', 'No widgets have been added to ACT home yet.')}
    />
  );
}
