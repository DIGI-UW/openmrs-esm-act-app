import React from 'react';
import { useTranslation } from 'react-i18next';
import { ExtensionSlot } from '@openmrs/esm-framework';
import { ActHomeCard } from '../act-home/act-home-card.component';
import styles from './quick-actions.scss';

/** The quick action slot of each home. A deployment adds, removes or orders a home's actions in its slot's config. */
export const quickActionSlots = {
  actHome: 'act-home-quick-actions-slot',
  communityHome: 'act-community-home-quick-actions-slot',
};

/** A home's Quick actions card: one tile per extension in the home's slot, each behind its action's privilege. */
export function QuickActions({ slot }: { slot: string }) {
  const { t } = useTranslation();
  return (
    <ActHomeCard title={t('quickActions', 'Quick actions')}>
      <ExtensionSlot name={slot} className={styles.tiles} />
    </ActHomeCard>
  );
}

export function ActHomeQuickActions() {
  return <QuickActions slot={quickActionSlots.actHome} />;
}

export function CommunityHomeQuickActions() {
  return <QuickActions slot={quickActionSlots.communityHome} />;
}
