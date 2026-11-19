import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import dayjs from 'dayjs';
import {
  Button,
  ButtonSet,
  InlineLoading,
  InlineNotification,
  RadioButton,
  RadioButtonGroup,
  Select,
  SelectItem,
  TextArea,
  TextInput,
} from '@carbon/react';
import {
  formatDate,
  parseDate,
  restBaseUrl,
  showSnackbar,
  useConfig,
  userHasAccess,
  useSession,
  Workspace2,
  type Workspace2DefinitionProps,
} from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { PRIVILEGE_EDIT_PATIENT_PROGRAMS, PRIVILEGE_EDIT_PEOPLE } from '../constants';
import { restErrorMessage } from '../rest-error-message';
import {
  endEnrolment,
  markDead,
  saveStatusAnswers,
  type StatusAnswer,
  statusOf,
  statusOptionsOf,
  terminalStatesOf,
  usePatientStatus,
} from './patient-status.resource';
import styles from './update-patient-status.scss';

const day = (value: string) => formatDate(parseDate(value), { time: false });

/**
 * Update patient status, which replaces Mark patient deceased: ends the patient's registry enrolment in one of its
 * workflow's terminal states, as the registry, worklists and Dashboard read it, and marks the person dead for Deceased.
 * The questions ACT 2.0's Patient Information asked with a status are asked here and kept on that record: a death's
 * cause and details, whether a woman was pregnant or postpartum at death, and where a relocated patient went.
 */
export default function UpdatePatientStatusWorkspace({
  closeWorkspace,
  groupProps: { patientUuid },
}: Workspace2DefinitionProps<object, object, { patientUuid: string }>) {
  const { t } = useTranslation();
  const { patientStatus } = useConfig<Config>();
  const { user, sessionLocation } = useSession();
  const { mutate } = useSWRConfig();
  const { enrolment, program, person, isLoading, error } = usePatientStatus(patientUuid, patientStatus.programUuid);
  const today = dayjs().format('YYYY-MM-DD');
  const [stateUuid, setStateUuid] = useState('');
  const [date, setDate] = useState(today);
  const [cause, setCause] = useState('');
  const [details, setDetails] = useState('');
  const [pregnant, setPregnant] = useState('');
  const [relocationArea, setRelocationArea] = useState('');
  const [saving, setSaving] = useState(false);
  // Set once the person is saved dead, and once the answers are saved, so that a retry does not save them again.
  const [personSaved, setPersonSaved] = useState(false);
  const [answersSaved, setAnswersSaved] = useState(false);

  const mayEditPrograms = Boolean(user) && userHasAccess(PRIVILEGE_EDIT_PATIENT_PROGRAMS, user);
  const mayEditPeople = Boolean(user) && userHasAccess(PRIVILEGE_EDIT_PEOPLE, user);
  const personDead = Boolean(person?.dead) || personSaved;
  // Dead before this update: the death's questions were answered when it was recorded.
  const diedBefore = Boolean(person?.dead) && !personSaved;
  const female = person?.gender === 'F';
  const enrolmentActive = Boolean(enrolment) && !enrolment!.dateCompleted;
  const options =
    program && person
      ? statusOptionsOf({
          states: terminalStatesOf(program, patientStatus.deathConcept),
          enrolmentActive,
          personDead,
          mayEditPrograms,
          mayEditPeople,
        })
      : [];
  const chosen = options.find((one) => one.uuid === stateUuid);
  const dyingNow = Boolean(chosen?.death) && !personDead;
  // The death's questions stay until its answers are saved, through a retry after the death itself was saved.
  const recordingDeath = Boolean(chosen?.death) && !diedBefore;
  const relocating = Boolean(chosen) && chosen!.concept === patientStatus.relocationConcept;
  const earliest = [
    enrolmentActive ? enrolment!.dateEnrolled.slice(0, 10) : '',
    // Core refuses to end a state before it started.
    ...(enrolmentActive ? enrolment!.states.filter((one) => !one.voided).map((one) => one.startDate.slice(0, 10)) : []),
    dyingNow ? (person?.birthdate?.slice(0, 10) ?? '') : '',
  ].reduce((a, b) => (a > b ? a : b));
  const deathAnswered = Boolean(cause) && (!female || Boolean(pregnant));
  const valid =
    Boolean(chosen && date && date <= today && date >= earliest && (!recordingDeath || deathAnswered)) && !saving;
  const ended = enrolment ? statusOf(enrolment) : null;
  const current = personDead
    ? t('deceasedOn', 'Deceased{{on}}', { on: person?.deathDate ? ` ${day(person.deathDate)}` : '' })
    : enrolmentActive
      ? t('active', 'Active')
      : ended
        ? `${ended.name ?? t('inactive', 'Inactive')} (${day(ended.since)})`
        : t('notInRegistry', 'Not in the registry');

  const chooseState = (uuid: string) => {
    setStateUuid(uuid);
    // A death already on the person is dated as it was recorded.
    if (options.find((one) => one.uuid === uuid)?.death && person?.dead && person.deathDate) {
      setDate(person.deathDate.slice(0, 10));
    }
  };

  /** The answers to keep with the status: a death's always has its cause; a relocation's area only when given. */
  const answers = (): Array<StatusAnswer> => {
    const { concepts } = patientStatus;
    if (recordingDeath) {
      return [
        { concept: concepts.causeOfDeath, value: cause },
        ...(details.trim() ? [{ concept: concepts.detailsOfDeath, value: details.trim() }] : []),
        ...(female ? [{ concept: concepts.pregnantOrPostpartumAtDeath, value: pregnant }] : []),
      ];
    }
    if (relocating && relocationArea.trim()) {
      return [{ concept: concepts.relocationArea, value: relocationArea.trim() }];
    }
    return [];
  };

  // Everything read under the patient follows: the banner, the registry reads and the flags.
  const refreshPatient = () =>
    mutate(
      (key) =>
        (Array.isArray(key) && key[0] === 'patient' && key[1] === patientUuid) ||
        (typeof key === 'string' &&
          (key.includes(`patient=${patientUuid}`) ||
            key.includes(`/person/${patientUuid}`) ||
            key.includes(`/Patient/${patientUuid}`) ||
            key.startsWith(`${restBaseUrl}/patient/${patientUuid}`))),
    );

  const save = async () => {
    if (!chosen) {
      return;
    }
    setSaving(true);
    let diedNow = false;
    try {
      if (chosen.death && !personDead && mayEditPeople) {
        await markDead(patientUuid, date, cause);
        setPersonSaved(true);
        diedNow = true;
      }
      const toSave = answers();
      if (toSave.length > 0 && !answersSaved) {
        await saveStatusAnswers({
          patient: patientUuid,
          encounterType: patientStatus.encounterType,
          form: patientStatus.form,
          location: sessionLocation?.uuid ?? null,
          date,
          answers: toSave,
        });
        setAnswersSaved(true);
      }
      if (enrolmentActive && mayEditPrograms) {
        await endEnrolment(enrolment!.uuid, chosen.uuid, date, enrolment!.dateEnrolled);
      }
    } catch (e) {
      showSnackbar({
        kind: 'error',
        title: diedNow
          ? t('deathSavedEnrolmentNot', 'The death was saved but the registry status was not')
          : t('statusNotUpdated', 'The patient status could not be updated'),
        subtitle: diedNow
          ? `${restErrorMessage(e)} ${t('saveAgainToFinish', 'Save again to finish.')}`
          : restErrorMessage(e),
      });
      setSaving(false);
      if (diedNow) {
        await refreshPatient();
      }
      return;
    }
    showSnackbar({ kind: 'success', title: t('patientStatusUpdated', 'Patient status updated') });
    await refreshPatient();
    closeWorkspace({ discardUnsavedChanges: true });
  };

  const passive = !isLoading && !error && options.length === 0;

  return (
    <Workspace2
      title={t('updatePatientStatus', 'Update patient status')}
      hasUnsavedChanges={
        Boolean(stateUuid) || Boolean(cause) || Boolean(details) || Boolean(relocationArea) || date !== today
      }
    >
      <div className={styles.form}>
        <div className={styles.body}>
          {error ? (
            <InlineNotification
              kind="error"
              lowContrast
              hideCloseButton
              title={t('statusNotLoaded', 'The patient status could not be loaded')}
              subtitle={restErrorMessage(error)}
            />
          ) : isLoading ? (
            <InlineLoading description={t('loading', 'Loading')} />
          ) : (
            <>
              <dl className={styles.current} data-testid="current-status">
                <div>
                  <dt>{t('currentStatus', 'Current status')}</dt>
                  <dd>{current}</dd>
                </div>
              </dl>
              {options.length === 0 ? (
                <p>{t('nothingToUpdate', 'There is nothing to update for this patient.')}</p>
              ) : (
                <>
                  <Select
                    id="update-patient-status-state"
                    labelText={t('status', 'Status')}
                    value={stateUuid}
                    onChange={(event) => chooseState(event.target.value)}
                  >
                    <SelectItem value="" text={t('chooseStatus', 'Choose a status')} />
                    {options.map((one) => (
                      <SelectItem key={one.uuid} value={one.uuid} text={one.name} />
                    ))}
                  </Select>
                  <TextInput
                    id="update-patient-status-date"
                    type="date"
                    labelText={
                      chosen?.death
                        ? t('dateOfDeath', 'Date of death')
                        : t('dateOfStatusChange', 'Date of status change')
                    }
                    value={date}
                    min={earliest || undefined}
                    max={today}
                    onChange={(event) => setDate(event.target.value)}
                  />
                  {recordingDeath && (
                    <>
                      <Select
                        id="update-patient-status-cause"
                        labelText={t('causeOfDeath', 'Cause of death')}
                        value={cause}
                        onChange={(event) => setCause(event.target.value)}
                      >
                        <SelectItem value="" text={t('chooseCause', 'Choose a cause')} />
                        {patientStatus.causesOfDeath.map((one) => (
                          <SelectItem key={one.uuid} value={one.uuid} text={one.label} />
                        ))}
                      </Select>
                      <TextArea
                        id="update-patient-status-details"
                        labelText={t('detailsOfDeath', 'Details of death')}
                        helperText={t('detailsOfDeathHelp', 'The events leading up to the death, if known')}
                        rows={3}
                        value={details}
                        onChange={(event) => setDetails(event.target.value)}
                      />
                      {female && (
                        <RadioButtonGroup
                          name="update-patient-status-pregnant"
                          legendText={t('pregnantOrPostpartumAtDeath', 'Pregnant or postpartum at death')}
                          orientation="horizontal"
                          valueSelected={pregnant}
                          onChange={(value) => setPregnant(String(value))}
                        >
                          <RadioButton
                            id="update-patient-status-pregnant-yes"
                            labelText={t('yes', 'Yes')}
                            value={patientStatus.concepts.yes}
                          />
                          <RadioButton
                            id="update-patient-status-pregnant-no"
                            labelText={t('no', 'No')}
                            value={patientStatus.concepts.no}
                          />
                        </RadioButtonGroup>
                      )}
                    </>
                  )}
                  {relocating && (
                    <TextInput
                      id="update-patient-status-relocation-area"
                      labelText={t('relocationArea', 'Relocation area')}
                      helperText={t('relocationAreaHelp', 'Where the patient moved to, if known')}
                      value={relocationArea}
                      onChange={(event) => setRelocationArea(event.target.value)}
                    />
                  )}
                </>
              )}
            </>
          )}
        </div>
        <ButtonSet className={styles.footer}>
          {passive ? (
            <Button className={styles.button} kind="secondary" onClick={() => closeWorkspace()}>
              {t('close', 'Close')}
            </Button>
          ) : (
            <>
              <Button className={styles.button} kind="secondary" disabled={saving} onClick={() => closeWorkspace()}>
                {t('cancel', 'Cancel')}
              </Button>
              <Button className={styles.button} kind="primary" disabled={!valid} onClick={save}>
                {t('save', 'Save')}
              </Button>
            </>
          )}
        </ButtonSet>
      </div>
    </Workspace2>
  );
}
