import React from 'react';
import { useTranslation } from 'react-i18next';
import { DefinitionTooltip, Tag, Toggletip, ToggletipButton, ToggletipContent } from '@carbon/react';
import { isDesktop, useLayoutType } from '@openmrs/esm-framework';
import { highestPriority, type RhdFlagList } from '../rhd-flags/rhd-flag-lists.resource';
import styles from './registry.scss';

type Flag = Pick<RhdFlagList, 'flagName' | 'priority'>;

// Leftwards, as Flags is the table's last column.
const align = 'bottom-end';

// Red, blue and orange, as the chart draws the distro's RHD High, RHD Early Warning and RHD Data Quality priorities.
const tagTypes: Record<Flag['priority'], 'red' | 'blue' | 'warm-gray'> = {
  risk: 'red',
  earlyWarning: 'blue',
  dataQuality: 'warm-gray',
};

function FlagTag({ priority, children }: { priority: Flag['priority']; children: React.ReactNode }) {
  return (
    <Tag
      as="span"
      data-testid="registry-flag"
      data-priority={priority}
      type={tagTypes[priority]}
      className={styles[priority]}
      size="sm"
    >
      {children}
    </Tag>
  );
}

/**
 * A patient's RHD flags: one shows as its tag; several as one "N flags" tag, listing them in its tooltip.
 * `rowsBelow` is how many of the page's rows follow the patient's.
 */
export function RegistryFlags({ flags, rowsBelow }: { flags: Array<Flag>; rowsBelow: number }) {
  const { t } = useTranslation();
  const desktop = isDesktop(useLayoutType());
  if (flags.length < 2) {
    return flags.map((flag) => (
      <FlagTag key={flag.flagName} priority={flag.priority}>
        {flag.flagName}
      </FlagTag>
    ));
  }
  const label = t('flagCount', '{{number}} flags', { number: flags.length });
  const names = flags.map((flag) => flag.flagName).join(', ');
  const tag = <FlagTag priority={highestPriority(flags)}>{label}</FlagTag>;
  // Floating tracks every scroll, so only a tooltip with no more rows below it than flags floats.
  const floating = rowsBelow <= flags.length;
  // Off desktop a Toggletip, as in O3's ward app: a tap's trailing mouseleave shuts a hover tooltip.
  return desktop ? (
    <DefinitionTooltip
      className={styles.flagsTooltip}
      align={align}
      autoAlign={floating}
      openOnHover
      definition={names}
    >
      {tag}
    </DefinitionTooltip>
  ) : (
    <Toggletip align={align} autoAlign={floating}>
      <ToggletipButton label={label}>{tag}</ToggletipButton>
      <ToggletipContent>{names}</ToggletipContent>
    </Toggletip>
  );
}
