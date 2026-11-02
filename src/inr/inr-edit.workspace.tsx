import React, { useRef, useState } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import { Button, ButtonSet, InlineLoading, InlineNotification, Select, SelectItem, TextInput } from '@carbon/react';
import {
  restBaseUrl,
  showSnackbar,
  useConfig,
  Workspace2,
  type Workspace2DefinitionProps,
} from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { useChartEncounters } from '../consultations/consultations.resource';
import { restErrorMessage } from '../rest-error-message';
import { latestInrEntry, saveInr, type InrEntry } from './inr-edit.resource';
import styles from './inr-window.scss';

const highest = 99;

type WorkspaceProps = Workspace2DefinitionProps<
  { encounterUuid: string; groupUuid?: string | null },
  object,
  { patientUuid: string }
>;

function EditForm({
  patientUuid,
  entry,
  title,
  closeWorkspace,
}: {
  patientUuid: string;
  entry: InrEntry;
  title: string;
  closeWorkspace: WorkspaceProps['closeWorkspace'];
}) {
  const { t } = useTranslation();
  const { inrReviews } = useConfig<Config>();
  const { mutate } = useSWRConfig();
  const initial = {
    dateTested: entry.dateTested || dayjs().format('YYYY-MM-DD'),
    inr: entry.inr === null ? '' : String(entry.inr),
    doseChange: entry.doseChange,
    newDose: entry.newDose,
    target: entry.target?.valueUuid ?? '',
    nextInr: entry.next?.value ?? '',
  };
  const [dateTested, setDateTested] = useState(initial.dateTested);
  const [inr, setInr] = useState(initial.inr);
  const [doseChange, setDoseChange] = useState(initial.doseChange);
  const [newDose, setNewDose] = useState(initial.newDose);
  const [target, setTarget] = useState(initial.target);
  const [nextInr, setNextInr] = useState(initial.nextInr);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const shared = entry.groupCount > 1;
  const { yes, no, targets } = inrReviews.answers;

  const value = Number(inr);
  const inrInvalid = !inr.trim() || !Number.isFinite(value) || value <= 0 || value > highest;
  const dateInvalid = !dateTested;
  const unsaved =
    dateTested !== initial.dateTested ||
    inr !== initial.inr ||
    doseChange !== initial.doseChange ||
    newDose !== initial.newDose ||
    target !== initial.target ||
    nextInr !== initial.nextInr;

  const save = async () => {
    setSubmitted(true);
    if (inrInvalid || dateInvalid) {
      return;
    }
    setSaving(true);
    setError('');
    try {
      await saveInr({
        patient: patientUuid,
        concepts: inrReviews.concepts,
        entry,
        edit: {
          dateTested,
          inr: value,
          doseChange,
          newDose: doseChange === yes ? newDose.trim() : '',
          target,
          nextInr,
        },
      });
    } catch (e) {
      setError(restErrorMessage(e) || t('couldNotSaveInr', 'The INR could not be saved'));
      setSaving(false);
      return;
    }
    showSnackbar({ kind: 'success', title: t('inrSaved', 'INR saved') });
    // Closed first: the rewritten group's new uuid is not the one this workspace was opened with.
    closeWorkspace({ discardUnsavedChanges: true });
    await mutate((key) => typeof key === 'string' && key.startsWith(`${restBaseUrl}/encounter?patient=${patientUuid}`));
  };

  return (
    <Workspace2 title={title} hasUnsavedChanges={unsaved}>
      <div className={styles.form}>
        <div className={styles.body}>
          <TextInput
            id="inr-date-tested"
            type="date"
            labelText={t('dateTested', 'Date tested')}
            value={dateTested}
            invalid={submitted && dateInvalid}
            invalidText={t('dateTestedRequired', 'Enter the date tested')}
            onChange={(event) => setDateTested(event.target.value)}
          />
          <TextInput
            id="inr-value"
            type="number"
            step="0.1"
            min="0"
            max={highest}
            labelText={t('inrValue', 'INR value')}
            value={inr}
            invalid={submitted && inrInvalid}
            invalidText={t('inrValueInvalid', 'Enter an INR above 0 and up to {{highest}}', { highest })}
            onChange={(event) => setInr(event.target.value)}
          />
          <Select
            id="inr-dose-change"
            labelText={t('doseChange', 'Dose change')}
            value={doseChange}
            onChange={(event) => setDoseChange(event.target.value)}
          >
            <SelectItem value="" text="" />
            <SelectItem value={yes} text={t('yes', 'Yes')} />
            <SelectItem value={no} text={t('no', 'No')} />
          </Select>
          {doseChange === yes && (
            <TextInput
              id="inr-new-dose"
              labelText={t('newDose', 'New anticoagulant dose')}
              value={newDose}
              onChange={(event) => setNewDose(event.target.value)}
            />
          )}
          <Select
            id="inr-target"
            labelText={t('inrTarget', 'INR target')}
            value={target}
            disabled={shared}
            helperText={
              shared ? t('sharedWithEarlier', 'Shared with the earlier entries; record a new INR to change it') : ''
            }
            onChange={(event) => setTarget(event.target.value)}
          >
            {!entry.target && <SelectItem value="" text="" />}
            {targets.map((one) => (
              <SelectItem key={one.uuid} value={one.uuid} text={one.label} />
            ))}
          </Select>
          <TextInput
            id="inr-next"
            type="date"
            labelText={t('nextInrDate', 'Next INR date')}
            value={nextInr}
            disabled={shared}
            onChange={(event) => setNextInr(event.target.value)}
          />
          {error && <InlineNotification kind="error" hideCloseButton lowContrast title={error} />}
        </div>
        <ButtonSet className={styles.footer}>
          <Button className={styles.button} kind="secondary" disabled={saving} onClick={() => closeWorkspace()}>
            {t('cancel', 'Cancel')}
          </Button>
          <Button className={styles.button} kind="primary" disabled={saving} onClick={save}>
            {t('save', 'Save')}
          </Button>
        </ButtonSet>
      </div>
    </Workspace2>
  );
}

/** Edit INR monitoring, which writes the entry's group again itself, as the form engine's edit drops Date Tested. */
export default function InrEditWorkspace({
  closeWorkspace,
  workspaceProps: { encounterUuid, groupUuid },
  groupProps: { patientUuid },
}: WorkspaceProps) {
  const { t } = useTranslation();
  const { inrReviews } = useConfig<Config>();
  const { encounters, error, isLoading } = useChartEncounters(patientUuid, inrReviews.encounterType);
  const found = latestInrEntry(
    encounters.filter((encounter) => encounter.uuid === encounterUuid),
    inrReviews.concepts,
    groupUuid,
  );
  const loaded = !groupUuid || found?.group?.uuid === groupUuid ? found : null;
  // Kept as opened: a reload while editing must not swap the form for another entry or for not found.
  const opened = useRef<InrEntry | null>(null);
  opened.current ??= loaded;
  const entry = opened.current;
  const title = t('editInrMonitoring', 'Edit INR monitoring');

  if (!entry) {
    return (
      <Workspace2 title={title}>
        {isLoading ? (
          <InlineLoading className={styles.body} description={t('loading', 'Loading...')} />
        ) : (
          <InlineNotification
            className={styles.body}
            kind="error"
            hideCloseButton
            lowContrast
            title={
              error ? t('inrLoadError', 'The INR could not be loaded') : t('inrNotFound', 'This INR could not be found')
            }
          />
        )}
      </Workspace2>
    );
  }
  return (
    <EditForm
      key={entry.group?.uuid ?? entry.encounterUuid}
      patientUuid={patientUuid}
      entry={entry}
      title={title}
      closeWorkspace={closeWorkspace}
    />
  );
}
