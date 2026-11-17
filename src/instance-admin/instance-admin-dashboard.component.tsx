import React from 'react';
import { useTranslation } from 'react-i18next';
import { HomeDashboard } from '../act-home/act-home-dashboard.component';
import { instanceAdminWidgetsSlot } from './instance-admin.meta';

/** The Instance admin's home: its header, then the widgets assigned to its slot. */
export default function InstanceAdminDashboard() {
  const { t } = useTranslation();
  return (
    <HomeDashboard
      title={t('home', 'Home')}
      widgetsSlot={instanceAdminWidgetsSlot}
      emptyMessage={t('noCommunityHomeWidgets', 'No widgets have been added to Home yet.')}
    />
  );
}
