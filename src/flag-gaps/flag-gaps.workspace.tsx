import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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
import { fetchForm, type FlagGap, type FlagGaps, usePatientFlagGaps } from './flag-gaps.resource';
import { MayEnterForm } from '../access/may-enter-form';
import { useOpenFormInVisit } from '../visits/open-form-in-visit';
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

/** Opens the form configured for a flag as a new form, in the patient's visit, named after the form. */
function NewFormButton({ patientUuid, formUuid, concept }: { patientUuid: string; formUuid: string; concept: string }) {
  const { t } = useTranslation();
  const { data: form } = useSWRImmutable(['act-form', formUuid], () => fetchForm(formUuid));
  const { open, isOpening } = useOpenFormInVisit(patientUuid);
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
> = ({ workspaceProps, groupProps, launchChildWorkspace }) => {
  const { t } = useTranslation();
  const desktop = isDesktop(useLayoutType());
  const { flagForms } = useConfig<Config>().flagLists;
  const patientUuid = workspaceProps?.patientUuid ?? groupProps?.patientUuid;
  const clickedFlag = workspaceProps?.flagUuid
    ? { uuid: workspaceProps.flagUuid, name: workspaceProps.flagName }
    : undefined;
  const { flagGaps, isLoading, error } = usePatientFlagGaps(patientUuid, clickedFlag);
  const listed = flagGaps.filter((flag) => flag.configured);

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
    return listed.map((flag) => (
      <section key={flag.flagUuid} className={styles.flag}>
        {clickedFlag ? null : <h4 className={styles.flagName}>{flag.flagName}</h4>}
        {renderGaps(flag)}
      </section>
    ));
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
            <NewFormButton patientUuid={patientUuid} formUuid={flagForm.form} concept={flagForm.concept} />
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
