import React from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { Button } from '@carbon/react';
import { Download } from '@carbon/react/icons';
import { UserHasAccess } from '@openmrs/esm-framework';
import { PRIVILEGE_EXPORT_LISTS } from '../constants';
import { downloadCsv } from './csv';

/**
 * A list's Download CSV, for a user who may export lists: `rows` as the list shows them, in a file named after the list
 * and today's date. The rows are built only when clicked.
 */
export function DownloadCsvButton({
  name,
  headers,
  rows,
  disabled,
  size = 'sm',
}: {
  name: string;
  headers: Array<string>;
  rows: () => Array<Array<string>>;
  disabled?: boolean;
  size?: 'sm' | 'md';
}) {
  const { t } = useTranslation();
  return (
    <UserHasAccess privilege={PRIVILEGE_EXPORT_LISTS}>
      <Button
        kind="tertiary"
        size={size}
        renderIcon={Download}
        disabled={disabled}
        onClick={() => downloadCsv(`${name}-${dayjs().format('YYYY-MM-DD')}.csv`, headers, rows())}
      >
        {t('downloadCsv', 'Download CSV')}
      </Button>
    </UserHasAccess>
  );
}
