import React from 'react';
import { useTranslation } from 'react-i18next';
import { ExtensionSlot } from '@openmrs/esm-framework';
import { ActHomeCard } from '../act-home/act-home-card.component';
import { communityHomeQuickActionsSlot } from './community-home.meta';
import styles from './community-quick-actions.scss';

/** Home's Quick actions: one tile per extension in their slot, each behind the privilege its action needs. */
export default function CommunityQuickActions() {
  const { t } = useTranslation();

  return (
    <ActHomeCard title={t('quickActions', 'Quick actions')}>
      <ExtensionSlot name={communityHomeQuickActionsSlot} className={styles.tiles} />
    </ActHomeCard>
  );
}
