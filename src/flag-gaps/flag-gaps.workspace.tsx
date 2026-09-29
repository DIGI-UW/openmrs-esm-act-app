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
import { type FlagGap, type FlagGaps, usePatientFlagGaps } from './flag-gaps.resource';
import { openEncounterForm } from './open-encounter-form';
import styles from './flag-gaps.scss';

/** What a patient flags app that passes the clicked flag launches a flag action's workspace with. */
export interface FlagActionWorkspaceProps {
  patientUuid: string;
  patientFlagUuid: string;
  flagUuid: string;
  flagName: string;
}

/** The patient chart's workspace group props, which carry the patient when the flag is not passed. */
interface PatientChartGroupProps {
  patientUuid?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysPending(encounterDatetime: string, now = new Date()) {
  return Math.floor((now.getTime() - new Date(encounterDatetime).getTime()) / DAY_MS);
}

const FlagGapsWorkspace: React.FC<
  Workspace2DefinitionProps<Partial<FlagActionWorkspaceProps>, object, PatientChartGroupProps>
> = ({ workspaceProps, groupProps, launchChildWorkspace }) => {
  const { t } = useTranslation();
  const patientUuid = workspaceProps?.patientUuid ?? groupProps?.patientUuid;
  const clickedFlag = workspaceProps?.flagUuid
    ? { uuid: workspaceProps.flagUuid, name: workspaceProps.flagName }
    : undefined;
  const { flagGaps, isLoading, error } = usePatientFlagGaps(patientUuid, clickedFlag);
  const listed = flagGaps.filter((flag) => flag.configured);

  const openGap = useCallback(
    async (gap: FlagGap) => {
      try {
        await openEncounterForm(launchChildWorkspace, gap.form.uuid, gap.encounter);
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
    if (listed.length === 0) {
      return (
        <p className={styles.message}>
          {clickedFlag
            ? t('noGapList', 'This flag does not list its missing data.')
            : t('noGapLists', "None of this patient's flags lists its missing data.")}
        </p>
      );
    }
    return listed.map((flag) => (
      <section key={flag.flagUuid} className={styles.flag}>
        {clickedFlag ? null : <h4 className={styles.flagName}>{flag.flagName}</h4>}
        {renderGaps(flag)}
      </section>
    ));
  };

  const renderGaps = ({ gaps }: FlagGaps) => {
    if (gaps.length === 0) {
      // The flag is raised but the data has no saved form to go on yet, so it needs a new one.
      return (
        <>
          <p className={styles.message}>
            {t('noSavedForm', 'No saved form is waiting to be completed. Record the missing data on a new form.')}
          </p>
          <Button kind="ghost" size="sm" onClick={() => launchChildWorkspace('clinical-forms-workspace')}>
            {t('openClinicalForms', 'Open clinical forms')}
          </Button>
        </>
      );
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
    <Workspace2 title={clickedFlag?.name ?? t('missingData', 'Missing data')}>
      <div className={styles.container}>{renderContent()}</div>
    </Workspace2>
  );
};

export default FlagGapsWorkspace;
