import React from 'react';
import { useTranslation } from 'react-i18next';
import { HomeDashboard } from '../act-home/act-home-dashboard.component';
import { communityHomeWidgetsSlot } from './community-home.meta';

/** Home: its header, then the widgets assigned to its slot. */
export default function CommunityHomeDashboard() {
  const { t } = useTranslation();

  return (
    <HomeDashboard
      title={t('home', 'Home')}
      widgetsSlot={communityHomeWidgetsSlot}
      emptyMessage={t('noCommunityHomeWidgets', 'No widgets have been added to Home yet.')}
    />
  );
}
