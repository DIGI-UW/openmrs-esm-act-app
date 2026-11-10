import React from 'react';
import { useTranslation } from 'react-i18next';
import { DefinitionTooltip, Tag, Toggletip, ToggletipButton, ToggletipContent } from '@carbon/react';
import { isDesktop, useLayoutType } from '@openmrs/esm-framework';
import styles from './due-for-prophylaxis.scss';

export function DueNowTag({ count }: { count: number }) {
  const { t } = useTranslation();
  const desktop = isDesktop(useLayoutType());
  if (!count) {
    return null;
  }
  const label = t('dueNowCount', '{{count}} due now', { count });
  const explanation = t(
    'dueNowExplanation',
    'Overdue or due today, and not recorded today. The list also includes patients due in the next 48 hours.',
  );
  const tag = (
    <Tag as="span" type="red">
      {label}
    </Tag>
  );
  // Keep a Toggletip off desktop: a tap's trailing mouseleave closes a hover tooltip.
  return desktop ? (
    <DefinitionTooltip className={styles.dueNowTooltip} align="bottom-end" openOnHover definition={explanation}>
      {tag}
    </DefinitionTooltip>
  ) : (
    <Toggletip align="bottom-end">
      <ToggletipButton label={label}>{tag}</ToggletipButton>
      <ToggletipContent>
        <p>{explanation}</p>
      </ToggletipContent>
    </Toggletip>
  );
}
