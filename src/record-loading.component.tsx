import React from 'react';
import { InlineLoading, InlineNotification } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { Workspace2 } from '@openmrs/esm-framework';

interface RecordLoadingProps {
  title: string;
  /** The load has finished, or failed, and the record is still not there. */
  settled: boolean;
  notFound: string;
}

/** A workspace's body while the record it edits is read again, or its message when that finds nothing. */
export function RecordLoading({ title, settled, notFound }: RecordLoadingProps) {
  const { t } = useTranslation();
  return (
    <Workspace2 title={title}>
      {settled ? (
        <InlineNotification
          kind="error"
          statusIconDescription={t('errorIcon', 'error icon')}
          lowContrast
          hideCloseButton
          title={notFound}
        />
      ) : (
        <InlineLoading description={t('loading', 'Loading...')} />
      )}
    </Workspace2>
  );
}
