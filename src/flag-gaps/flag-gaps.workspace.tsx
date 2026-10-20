import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import useSWRImmutable from 'swr/immutable';
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
import {
  formatDate,
  isDesktop,
  showSnackbar,
  useConfig,
  useLayoutType,
  Workspace2,
  type Workspace2DefinitionProps,
} from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import {
  dismissFlag,
  fetchForm,
  type FlagGap,
  type FlagGaps,
  type RaisedFlag,
  usePatientFlagGaps,
  useRaisedFlags,
} from './flag-gaps.resource';
import { restErrorMessage } from '../rest-error-message';
import { MayEnterForm } from '../access/may-enter-form';
import { type FormLauncher, useOpenFormInVisit } from '../visits/open-form-in-visit';
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

/** Whole days from the day the flag was raised to today, as ACT 2.0 counted a critical data flag's days pending. */
export function daysOpen(raisedSince: string, now = new Date()) {
  const since = new Date(raisedSince);
  const raisedDay = new Date(since.getFullYear(), since.getMonth(), since.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today.getTime() - raisedDay.getTime()) / DAY_MS);
}

/** How long the flag has been open and, for a user who may, Dismiss, which asks before it dismisses. */
function FlagStatus({
  patientUuid,
  raised,
  onDismissed,
}: {
  patientUuid: string;
  raised: RaisedFlag;
  onDismissed: () => void;
}) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const { mutate } = useSWRConfig();

  const dismiss = async () => {
    setDismissing(true);
    try {
      await dismissFlag(patientUuid, raised.flag, mutate);
      showSnackbar({ kind: 'success', title: t('flagDismissed', 'Flag dismissed') });
      onDismissed();
    } catch (e) {
      showSnackbar({
        kind: 'error',
        title: t('couldNotDismissFlag', 'Could not dismiss the flag'),
        subtitle: restErrorMessage(e),
      });
      setDismissing(false);
    }
  };

  return (
    <div className={styles.status}>
      {raised.raisedSince ? (
        <p className={styles.message}>
          {t('openForDays', 'Open for {{count}} days, since {{date}}', {
            count: daysOpen(raised.raisedSince),
            date: formatDate(new Date(raised.raisedSince), { mode: 'standard', time: false }),
          })}
        </p>
      ) : null}
      {raised.dismissible && confirming ? (
        <div className={styles.confirm}>
          <p className={styles.message}>
            {t('confirmDismissFlag', 'Dismiss this flag? It stays dismissed until the data no longer raises it.')}
          </p>
          <Button kind="danger" size="sm" disabled={dismissing} onClick={dismiss}>
            {t('dismissFlag', 'Dismiss flag')}
          </Button>
          <Button kind="ghost" size="sm" disabled={dismissing} onClick={() => setConfirming(false)}>
            {t('cancel', 'Cancel')}
          </Button>
        </div>
      ) : null}
      {raised.dismissible && !confirming ? (
        <Button kind="ghost" size="sm" onClick={() => setConfirming(true)}>
          {t('dismiss', 'Dismiss')}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Opens the form configured for a flag as a new form, in the patient's visit, named after the form. As a child of this
 * workspace, since both share the clinical forms window.
 */
function NewFormButton({
  patientUuid,
  formUuid,
  concept,
  launch,
}: {
  patientUuid: string;
  formUuid: string;
  concept: string;
  launch: FormLauncher;
}) {
  const { t } = useTranslation();
  const { data: form } = useSWRImmutable(['act-form', formUuid], () => fetchForm(formUuid));
  const { open, isOpening } = useOpenFormInVisit(patientUuid, launch);
  return (
    <MayEnterForm formUuid={formUuid}>
      <Button kind="ghost" size="sm" disabled={isOpening} onClick={() => open(formUuid, concept || undefined)}>
        {form?.display ? t('openNamedForm', 'Open {{form}}', { form: form.display }) : t('openForm', 'Open form')}
      </Button>
    </MayEnterForm>
  );
}

const FlagGapsWorkspace: React.FC<
  Workspace2DefinitionProps<Partial<FlagActionWorkspaceProps>, object, PatientChartGroupProps>
> = ({ workspaceProps, groupProps, launchChildWorkspace, closeWorkspace }) => {
  const { t } = useTranslation();
  const desktop = isDesktop(useLayoutType());
  const { flagForms } = useConfig<Config>().flagLists;
  const patientUuid = workspaceProps?.patientUuid ?? groupProps?.patientUuid;
  const clickedFlag = workspaceProps?.flagUuid
    ? { uuid: workspaceProps.flagUuid, name: workspaceProps.flagName }
    : undefined;
  const { flagGaps, isLoading, error } = usePatientFlagGaps(patientUuid, clickedFlag);
  const { raisedFlags } = useRaisedFlags(patientUuid);
  // A flag whose criteria name no form rows, such as a risk flag over the adherence table, still opens the form
  // configured for it.
  const listed = flagGaps.filter((flag) => flag.configured || flagForms.some((entry) => entry.flag === flag.flagUuid));

  const openGap = useCallback(
    async (gap: FlagGap) => {
      try {
        await openEncounterForm(launchChildWorkspace, gap.form.uuid, gap.encounter, gap.concept.uuid);
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
      return <DataTableSkeleton role="progressbar" compact={desktop} zebra showHeader={false} showToolbar={false} />;
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
    return listed.map((flag) => {
      const raised = raisedFlags.find((candidate) => candidate.flag === flag.flagUuid);
      return (
        <section key={flag.flagUuid} className={styles.flag}>
          {clickedFlag ? null : <h4 className={styles.flagName}>{flag.flagName}</h4>}
          {raised ? (
            <FlagStatus
              patientUuid={patientUuid}
              raised={raised}
              // The clicked flag is gone once dismissed; with every flag listed, the list reloads without it.
              onDismissed={() => (clickedFlag ? closeWorkspace() : undefined)}
            />
          ) : null}
          {renderGaps(flag)}
        </section>
      );
    });
  };

  const renderGaps = ({ flagUuid, gaps }: FlagGaps) => {
    if (gaps.length === 0) {
      // The flag is raised but the data has no saved form to go on yet, so it needs a new one: the form configured
      // for the flag, or else one picked from the clinical forms list.
      const flagForm = flagForms.find((entry) => entry.flag === flagUuid);
      return (
        <>
          <p className={styles.message}>
            {t('noSavedForm', 'No saved form is waiting to be completed. Record the missing data on a new form.')}
          </p>
          {flagForm ? (
            <NewFormButton
              patientUuid={patientUuid}
              formUuid={flagForm.form}
              concept={flagForm.concept}
              launch={launchChildWorkspace}
            />
          ) : (
            <Button kind="ghost" size="sm" onClick={() => launchChildWorkspace('clinical-forms-workspace')}>
              {t('openClinicalForms', 'Open clinical forms')}
            </Button>
          )}
        </>
      );
    }
    return (
      <Table size={desktop ? 'sm' : 'lg'} useZebraStyles>
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
                  <MayEnterForm formUuid={gap.form.uuid}>
                    <Button kind="ghost" size="sm" onClick={() => openGap(gap)}>
                      {t('openForm', 'Open form')}
                    </Button>
                  </MayEnterForm>
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
