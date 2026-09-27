import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  DataTableSkeleton,
  InlineNotification,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { formatDate, showSnackbar, Workspace2, type Workspace2DefinitionProps } from '@openmrs/esm-framework';
import { fetchForm, type FlagGap, useFlagGaps } from './flag-gaps.resource';
import styles from './flag-gaps.scss';

/** What the patient flags app launches a flag action's workspace with. */
export interface FlagActionWorkspaceProps {
  patientUuid: string;
  patientFlagUuid: string;
  flagUuid: string;
  flagName: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysPending(encounterDatetime: string, now = new Date()) {
  return Math.floor((now.getTime() - new Date(encounterDatetime).getTime()) / DAY_MS);
}

const FlagGapsWorkspace: React.FC<Workspace2DefinitionProps<FlagActionWorkspaceProps, object, object>> = ({
  workspaceProps,
  launchChildWorkspace,
}) => {
  const { t } = useTranslation();
  const { gaps, configured, isLoading, error } = useFlagGaps(workspaceProps?.patientUuid, workspaceProps?.flagUuid);

  const openGap = useCallback(
    async (gap: FlagGap) => {
      try {
        const form = await fetchForm(gap.form.uuid);
        await launchChildWorkspace('patient-form-entry-workspace', { form, encounterUuid: gap.encounter });
      } catch (e) {
        showSnackbar({
          kind: 'error',
          title: t('couldNotOpenForm', 'Could not open the form'),
          subtitle: e?.message,
        });
      }
    },
    [launchChildWorkspace, t],
  );

  const renderContent = () => {
    if (isLoading) {
      return <DataTableSkeleton role="progressbar" compact zebra={false} showHeader={false} showToolbar={false} />;
    }
    if (error) {
      return (
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title={t('couldNotLoadGaps', 'Could not load the missing data')}
          subtitle={error.message}
        />
      );
    }
    if (!configured) {
      return <p className={styles.message}>{t('noGapList', 'This flag does not list its missing data.')}</p>;
    }
    if (gaps.length === 0) {
      return <p className={styles.message}>{t('nothingMissing', 'Nothing is missing for this flag.')}</p>;
    }
    return (
      <Table size="md" useZebraStyles={false}>
        <TableHead>
          <TableRow>
            <TableHeader>{t('form', 'Form')}</TableHeader>
            <TableHeader>{t('date', 'Date')}</TableHeader>
            <TableHeader>{t('missing', 'Missing')}</TableHeader>
            <TableHeader>{t('daysPending', 'Days pending')}</TableHeader>
            <TableHeader aria-label={t('actions', 'Actions')} />
          </TableRow>
        </TableHead>
        <TableBody>
          {gaps.map((gap) => (
            <TableRow key={`${gap.encounter}-${gap.concept.uuid}`}>
              <TableCell>{gap.form?.display ?? '--'}</TableCell>
              <TableCell>{formatDate(new Date(gap.encounterDatetime), { mode: 'standard', time: false })}</TableCell>
              <TableCell>{gap.concept.display}</TableCell>
              <TableCell>{daysPending(gap.encounterDatetime)}</TableCell>
              <TableCell>
                {gap.form ? (
                  <Button kind="ghost" size="sm" onClick={() => openGap(gap)}>
                    {t('openForm', 'Open form')}
                  </Button>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <Workspace2 title={workspaceProps?.flagName ?? t('missingData', 'Missing data')}>
      <div className={styles.container}>{renderContent()}</div>
    </Workspace2>
  );
};

export default FlagGapsWorkspace;
