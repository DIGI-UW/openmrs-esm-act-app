import React from 'react';
import { useTranslation } from 'react-i18next';
import { Layer, Tile } from '@carbon/react';
import { ExtensionSlot, HomePictogram, useAssignedExtensions } from '@openmrs/esm-framework';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import { useScreenAccess } from '../access/screen-access.component';
import { dataClerkWidgetsSlot } from './data-clerk.meta';
import styles from './data-clerk-dashboard.scss';

export default function DataClerkDashboard() {
  const { t } = useTranslation();
  const canSeeDataClerk = useScreenAccess('dataClerk');
  const widgets = useAssignedExtensions(dataClerkWidgetsSlot);

  if (!canSeeDataClerk) {
    return (
      <p className={styles.message}>
        {t('noAccessToDataClerk', 'You do not have access to the data clerk workspace.')}
      </p>
    );
  }

  return (
    <>
      <ActPageHeader title={t('dataClerk', 'Data clerk')} illustration={<HomePictogram />} />
      <div className={styles.dashboard}>
        {widgets.length ? (
          <ExtensionSlot name={dataClerkWidgetsSlot} className={styles.widgets} />
        ) : (
          <Layer>
            <Tile className={styles.message}>
              {t('noDataClerkWidgets', 'No widgets have been added to the data clerk workspace yet.')}
            </Tile>
          </Layer>
        )}
      </div>
    </>
  );
}
