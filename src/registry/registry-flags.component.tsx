import React from 'react';
import { useTranslation } from 'react-i18next';
import { DefinitionTooltip, Tag, Toggletip, ToggletipButton, ToggletipContent } from '@carbon/react';
import { isDesktop, useLayoutType } from '@openmrs/esm-framework';
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
  const tag = (
    <FlagTag priority={flags.some((flag) => flag.priority === 'risk') ? 'risk' : 'dataQuality'}>{label}</FlagTag>
  );
  // A tooltip opening below its tag grows about a row per flag, and would be cut off by the table's scroll box
  // past the page's last row, so a tooltip without that room floats over the page. The rest stay in place:
  // floating tracks every scroll, which slows a long page. They open leftwards, as Flags is the last column.
  const floating = rowsBelow <= flags.length;
  // A tooltip on hover on a desktop, and on a tap elsewhere, as O3's ward app does: a tap's trailing
  // mouseleave would close a hover tooltip.
  return desktop ? (
    <DefinitionTooltip
      className={styles.flagsTooltip}
      align="bottom-end"
      autoAlign={floating}
      openOnHover
      definition={names}
    >
      {tag}
    </DefinitionTooltip>
  ) : (
    <Toggletip align="bottom-end" autoAlign={floating}>
      <ToggletipButton label={label}>{tag}</ToggletipButton>
      <ToggletipContent>{names}</ToggletipContent>
    </Toggletip>
  );
}
