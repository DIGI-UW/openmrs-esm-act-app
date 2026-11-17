import React, { useState } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { Button, InlineLoading } from '@carbon/react';
import { Download } from '@carbon/react/icons';
import { showSnackbar, UserHasAccess } from '@openmrs/esm-framework';
import { PRIVILEGE_EXPORT_LISTS } from '../constants';
import { recordDownload } from '../logs/logs.resource';
import { restErrorMessage } from '../rest-error-message';
import { downloadCsv } from './csv';

type Rows = Array<Array<string>>;

/**
 * A list's Download CSV, for a user who may export lists: `rows` as the list shows them, in a file named after the list
 * and today's date. The rows are built only when clicked, and the download is recorded in ACT Core's download log
 * before the file is given; one that cannot be recorded does not happen, as ACT 2.0 logged every download.
 */
export function DownloadCsvButton({
  name,
  list,
  identifiers,
  filters = {},
  headers,
  rows,
  disabled,
  size = 'sm',
}: {
  name: string;
  /** What the log calls the list: registry, worklist:<name> or logs:<tab>. */
  list: string;
  /** Whether the rows name patients. */
  identifiers: boolean;
  /** The filters the rows were chosen by, for the log. */
  filters?: Record<string, string>;
  headers: Array<string>;
  rows: () => Rows | Promise<Rows>;
  disabled?: boolean;
  size?: 'sm' | 'md';
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    let built: Rows;
    try {
      built = await rows();
    } catch (e) {
      showSnackbar({
        kind: 'error',
        title: t('couldNotBuildFile', 'Could not build the file'),
        subtitle: restErrorMessage(e),
      });
      setBusy(false);
      return;
    }
    try {
      await recordDownload({ list, columns: headers, rows: built.length, identifiers, filters });
      downloadCsv(`${name}-${dayjs().format('YYYY-MM-DD')}.csv`, headers, built);
    } catch (e) {
      showSnackbar({
        kind: 'error',
        title: t('couldNotRecordDownload', 'Could not record the download, so no file was made'),
        subtitle: restErrorMessage(e),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <UserHasAccess privilege={PRIVILEGE_EXPORT_LISTS}>
      <Button kind="tertiary" size={size} renderIcon={Download} disabled={disabled || busy} onClick={download}>
        {busy ? <InlineLoading description={t('downloading', 'Downloading...')} /> : t('downloadCsv', 'Download CSV')}
      </Button>
    </UserHasAccess>
  );
}
