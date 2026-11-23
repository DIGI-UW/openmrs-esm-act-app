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
  correctEnrolment,
  endEnrolment,
  markDead,
  reenrol,
  saveStatusAnswers,
  type StatusAnswer,
  statusOf,
  statusOptionsOf,
  terminalStatesOf,
  usePatientStatus,
} from './patient-status.resource';
import styles from './update-patient-status.scss';

const day = (value: string) => formatDate(parseDate(value), { time: false });

/** The option that enrols a returning patient again, beside the workflow's terminal states. */
const REENROL = 'reenrol';

/**
 * Update patient status, which replaces Mark patient deceased: ends the patient's registry enrolment in one of its
 * workflow's terminal states, as the registry, worklists and Dashboard read it, and marks the person dead for Deceased.
 * The questions ACT 2.0's Patient Information asked with a status are asked here and kept on that record: a death's
 * cause and details, whether a woman was pregnant or postpartum at death, and where a relocated patient went. A
 * living patient whose enrolment ended can have its status corrected, or be enrolled again as Active on their return.
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
  // Set once the enrolment ended, and once the answers are saved: a retry saves only what is left, with the status
  // and date kept. An answer or date changed after that is saved again, replacing what was saved.
  const [enrolmentSaved, setEnrolmentSaved] = useState(false);
  const [answersSaved, setAnswersSaved] = useState(false);
  const answer =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setAnswersSaved(false);
    };

  const mayEditPrograms = Boolean(user) && userHasAccess(PRIVILEGE_EDIT_PATIENT_PROGRAMS, user);
  const mayEditPeople = Boolean(user) && userHasAccess(PRIVILEGE_EDIT_PEOPLE, user);
  const personDead = Boolean(person?.dead);
  const female = person?.gender === 'F';
  const enrolmentActive = Boolean(enrolment) && !enrolment!.dateCompleted;
  const enrolmentEnded = Boolean(enrolment) && !enrolmentActive;
  const options =
    program && person
      ? statusOptionsOf({
          states: [
            ...terminalStatesOf(program, patientStatus.deathConcept),
            {
              uuid: REENROL,
              name: t('activeReenrolled', 'Active (re-enrolled)'),
              concept: '',
              death: false,
              reenrol: true,
            },
          ],
          enrolmentActive,
          enrolmentEnded,
          personDead,
          mayEditPrograms,
          mayEditPeople,
        })
      : [];
  const chosen = options.find((one) => one.uuid === stateUuid);
  // The death is saved last, so its questions stay through a retry until it is.
  const dyingNow = Boolean(chosen?.death) && !personDead;
  const relocating = Boolean(chosen) && chosen!.concept === patientStatus.relocationConcept;
  const reenrolling = Boolean(chosen?.reenrol);
  // An ended enrolment's other status is corrected in place; a death leaves it as it ended.
  const correcting = enrolmentEnded && Boolean(chosen) && !chosen!.death && !reenrolling;
  const ended = enrolment ? statusOf(enrolment) : null;
  const earliest = [
    enrolmentActive || correcting ? enrolment!.dateEnrolled.slice(0, 10) : '',
    // Core refuses to end a state before it started; the state being corrected does not count.
    ...(enrolmentActive || correcting
      ? enrolment!.states
          .filter((one) => !one.voided && !(correcting && one.uuid === ended?.patientState))
          .map((one) => one.startDate.slice(0, 10))
      : []),
    // A returning patient's new enrolment may not overlap the one that ended.
    reenrolling ? enrolment!.dateCompleted!.slice(0, 10) : '',
    dyingNow ? (person?.birthdate?.slice(0, 10) ?? '') : '',
  ].reduce((a, b) => (a > b ? a : b));
  const deathAnswered = Boolean(cause) && (!female || Boolean(pregnant));
  const valid = Boolean(chosen && date && date <= today && date >= earliest && (!dyingNow || deathAnswered)) && !saving;
  const current = personDead
    ? t('deceasedOn', 'Deceased{{on}}', { on: person?.deathDate ? ` ${day(person.deathDate)}` : '' })
    : enrolmentActive
      ? t('active', 'Active')
      : ended
        ? `${ended.name ?? t('inactive', 'Inactive')} (${day(ended.since)})`
        : t('notInRegistry', 'Not in the registry');

  const chooseState = (uuid: string) => {
    setStateUuid(uuid);
    const death = options.find((one) => one.uuid === uuid)?.death;
    // A death already on the person, or on the ended enrolment, is dated as it was recorded.
    if (death && person?.dead && person.deathDate) {
      setDate(person.deathDate.slice(0, 10));
    } else if (death && ended?.uuid === uuid) {
      setDate(ended.since.slice(0, 10));
    }
  };

  /** The answers to keep with the status: a death's always has its cause; a relocation's area only when given. */
  const answers = (): Array<StatusAnswer> => {
    const { concepts } = patientStatus;
    if (dyingNow) {
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
    // The enrolment ends first, as ACT Core ends an open one when the person is saved dead; the answers follow, and
    // the death last, so that a death is never on the person without its cause recorded.
    let enrolmentEnded = enrolmentSaved;
    try {
      if (enrolmentActive && !enrolmentSaved && mayEditPrograms) {
        await endEnrolment(enrolment!.uuid, chosen.uuid, date, enrolment!.dateEnrolled);
        setEnrolmentSaved(true);
        enrolmentEnded = true;
      } else if (correcting && !enrolmentSaved) {
        await correctEnrolment({
          enrolmentUuid: enrolment!.uuid,
          endedStateUuid: ended?.patientState ?? null,
          stateUuid: chosen.uuid,
          date,
          dateEnrolled: enrolment!.dateEnrolled,
        });
        setEnrolmentSaved(true);
        enrolmentEnded = true;
      } else if (reenrolling && !enrolmentSaved) {
        await reenrol(patientUuid, patientStatus.programUuid, date, sessionLocation?.uuid ?? null);
        setEnrolmentSaved(true);
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
      if (chosen.death && !personDead && mayEditPeople) {
        await markDead(patientUuid, date, cause);
      }
    } catch (e) {
      showSnackbar({
        kind: 'error',
        title: !enrolmentEnded
          ? t('statusNotUpdated', 'The patient status could not be updated')
          : chosen.death
            ? t('statusSavedDeathNot', 'The registry status was saved but the death was not')
            : t('statusSavedDetailsNot', 'The registry status was saved but its details were not'),
        subtitle: enrolmentEnded
          ? `${restErrorMessage(e)} ${t('saveAgainToFinish', 'Save again to finish.')}`
          : restErrorMessage(e),
      });
      setSaving(false);
      if (enrolmentEnded) {
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
                    disabled={enrolmentSaved}
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
                        : reenrolling
                          ? t('dateOfReenrolment', 'Date of re-enrolment')
                          : t('dateOfStatusChange', 'Date of status change')
                    }
                    value={date}
                    min={earliest || undefined}
                    max={today}
                    disabled={enrolmentSaved || Boolean(chosen?.death && ended?.uuid === chosen.uuid)}
                    onChange={(event) => answer(setDate)(event.target.value)}
                  />
                  {dyingNow && (
                    <>
                      <Select
                        id="update-patient-status-cause"
                        labelText={t('causeOfDeath', 'Cause of death')}
                        value={cause}
                        onChange={(event) => answer(setCause)(event.target.value)}
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
                        onChange={(event) => answer(setDetails)(event.target.value)}
                      />
                      {female && (
                        <RadioButtonGroup
                          name="update-patient-status-pregnant"
                          legendText={t('pregnantOrPostpartumAtDeath', 'Pregnant or postpartum at death')}
                          orientation="horizontal"
                          valueSelected={pregnant}
                          onChange={(value) => answer(setPregnant)(String(value))}
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
                      onChange={(event) => answer(setRelocationArea)(event.target.value)}
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
