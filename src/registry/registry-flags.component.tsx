import React from 'react';
import { useTranslation } from 'react-i18next';
import { DefinitionTooltip, Tag } from '@carbon/react';
import { type RhdFlagList } from '../rhd-flags/rhd-flag-lists.resource';
import styles from './registry.scss';

type Flag = Pick<RhdFlagList, 'flagName' | 'priority'>;

function FlagTag({ priority, children }: { priority: Flag['priority']; children: React.ReactNode }) {
  return (
    <Tag
      as="span"
      data-testid="registry-flag"
      data-priority={priority}
      type={priority === 'risk' ? 'red' : 'warm-gray'}
      className={styles[priority]}
      size="sm"
    >
      {children}
    </Tag>
  );
}

/** A patient's RHD flags: one shows as its tag; several as one "N flags" tag, listing them in its tooltip. */
export function RegistryFlags({ flags }: { flags: Array<Flag> }) {
  const { t } = useTranslation();
  if (flags.length < 2) {
    return flags.map((flag) => (
      <FlagTag key={flag.flagName} priority={flag.priority}>
        {flag.flagName}
      </FlagTag>
    ));
  }
  // As O3's service queues show a priority's comment: a DefinitionTooltip opens on a tap as well as a hover.
  // autoAlign places it over the page, so the table's scroll box does not clip it on the last rows.
  return (
    <DefinitionTooltip
      className={styles.flagsTooltip}
      align="bottom-start"
      autoAlign
      openOnHover
      definition={flags.map((flag) => flag.flagName).join(', ')}
    >
      <FlagTag priority={flags.some((flag) => flag.priority === 'risk') ? 'risk' : 'dataQuality'}>
        {t('flagCount', '{{number}} flags', { number: flags.length })}
      </FlagTag>
    </DefinitionTooltip>
  );
}
