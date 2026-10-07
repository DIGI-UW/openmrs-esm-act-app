import React from 'react';
import { useTranslation } from 'react-i18next';
import { ExtensionSlot } from '@openmrs/esm-framework';
import { ActHomeCard } from '../act-home/act-home-card.component';
import { actHomeQuickActionsSlot } from '../act-home/act-home.meta';
import { communityHomeQuickActionsSlot } from '../community-home/community-home.meta';
import styles from './quick-actions.scss';

/**
 * A home's Quick actions card: one tile per extension in the home's slot, each behind its action's privilege.
 * A deployment adds, removes or orders a home's actions in its slot's config.
 */
export function QuickActions({ slot }: { slot: string }) {
  const { t } = useTranslation();
  return (
    <ActHomeCard title={t('quickActions', 'Quick actions')}>
      <ExtensionSlot name={slot} className={styles.tiles} />
    </ActHomeCard>
  );
}

export function ActHomeQuickActions() {
  return <QuickActions slot={actHomeQuickActionsSlot} />;
}

export function CommunityHomeQuickActions() {
  return <QuickActions slot={communityHomeQuickActionsSlot} />;
}
