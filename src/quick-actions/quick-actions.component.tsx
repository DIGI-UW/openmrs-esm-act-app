import React from 'react';
import { useTranslation } from 'react-i18next';
import { ExtensionSlot } from '@openmrs/esm-framework';
import { ActHomeCard } from '../act-home/act-home-card.component';
import { actHomeQuickActionsSlot } from '../act-home/act-home.meta';
import { communityHomeQuickActionsSlot } from '../community-home/community-home.meta';
import { instanceAdminQuickActionsSlot } from '../instance-admin/instance-admin.meta';
import styles from './quick-actions.scss';

/**
 * A home's quick actions: one tile per extension in the home's slot, each behind its action's privilege, in a card
 * when titled. A deployment adds, removes or orders a home's actions in its slot's config.
 */
export function QuickActions({ slot, title, tag }: { slot: string; title?: string; tag?: React.ReactNode }) {
  const tiles = <ExtensionSlot name={slot} className={styles.tiles} />;
  return title ? (
    <ActHomeCard title={title} tag={tag}>
      {tiles}
    </ActHomeCard>
  ) : (
    tiles
  );
}

/** ACT home's actions, as tiles across the top of the page. */
export function ActHomeQuickActions() {
  return <QuickActions slot={actHomeQuickActionsSlot} />;
}

export function CommunityHomeQuickActions() {
  const { t } = useTranslation();
  return <QuickActions slot={communityHomeQuickActionsSlot} title={t('quickActions', 'Quick actions')} />;
}

export function InstanceAdminQuickActions() {
  const { t } = useTranslation();
  return (
    <QuickActions
      slot={instanceAdminQuickActionsSlot}
      title={t('quickActions', 'Quick actions')}
      tag={<span className={styles.shownFor}>{t('shownForInstanceAdmin', 'Shown for Instance Administrator')}</span>}
    />
  );
}
