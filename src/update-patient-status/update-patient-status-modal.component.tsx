import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import dayjs from 'dayjs';
import { InlineLoading, InlineNotification, Modal, Select, SelectItem, TextInput } from '@carbon/react';
import {
  formatDate,
  parseDate,
  restBaseUrl,
  showSnackbar,
  useConfig,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { PRIVILEGE_EDIT_PATIENT_PROGRAMS, PRIVILEGE_EDIT_PEOPLE } from '../constants';
import { restErrorMessage } from '../rest-error-message';
import {
  endEnrolment,
  markDead,
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
 */
export default function UpdatePatientStatusModal({
  closeModal,
  patientUuid,
}: {
  closeModal: () => void;
  patientUuid: string;
}) {
  const { t } = useTranslation();
  const { patientStatus } = useConfig<Config>();
  const { user } = useSession();
  const { mutate } = useSWRConfig();
  const { enrolment, program, person, isLoading, error } = usePatientStatus(patientUuid, patientStatus.programUuid);
  const today = dayjs().format('YYYY-MM-DD');
  const [stateUuid, setStateUuid] = useState('');
  const [date, setDate] = useState(today);
  const [cause, setCause] = useState('');
  const [saving, setSaving] = useState(false);
  // Set once the person is saved dead, so that a retry does not save the death again.
  const [personSaved, setPersonSaved] = useState(false);

  const mayEditPrograms = Boolean(user) && userHasAccess(PRIVILEGE_EDIT_PATIENT_PROGRAMS, user);
  const mayEditPeople = Boolean(user) && userHasAccess(PRIVILEGE_EDIT_PEOPLE, user);
  const personDead = Boolean(person?.dead) || personSaved;
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
  const earliest = [
    enrolmentActive ? enrolment!.dateEnrolled.slice(0, 10) : '',
    dyingNow ? (person?.birthdate?.slice(0, 10) ?? '') : '',
  ].reduce((a, b) => (a > b ? a : b));
  const valid = Boolean(chosen && date && date <= today && date >= earliest && (!dyingNow || cause.trim())) && !saving;
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

  const save = async () => {
    if (!chosen) {
      return;
    }
    setSaving(true);
    let diedNow = false;
    try {
      if (chosen.death && !personDead && mayEditPeople) {
        await markDead(patientUuid, date, cause.trim());
        setPersonSaved(true);
        diedNow = true;
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
      return;
    }
    showSnackbar({ kind: 'success', title: t('patientStatusUpdated', 'Patient status updated') });
    // Everything read under the patient follows: the banner, the registry reads and the flags.
    await mutate(
      (key) =>
        typeof key === 'string' &&
        (key.includes(`patient=${patientUuid}`) ||
          key.includes(`/person/${patientUuid}`) ||
          key.includes(`/Patient/${patientUuid}`) ||
          key.startsWith(`${restBaseUrl}/patient/${patientUuid}`)),
    );
    closeModal();
  };

  return (
    <Modal
      open
      size="sm"
      passiveModal={!isLoading && !error && options.length === 0}
      modalHeading={t('updatePatientStatus', 'Update patient status')}
      primaryButtonText={t('save', 'Save')}
      secondaryButtonText={t('cancel', 'Cancel')}
      primaryButtonDisabled={!valid}
      onRequestSubmit={save}
      onRequestClose={closeModal}
      onSecondarySubmit={closeModal}
    >
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
                  chosen?.death ? t('dateOfDeath', 'Date of death') : t('dateOfStatusChange', 'Date of status change')
                }
                value={date}
                min={earliest || undefined}
                max={today}
                onChange={(event) => setDate(event.target.value)}
              />
              {dyingNow && (
                <TextInput
                  id="update-patient-status-cause"
                  labelText={t('causeOfDeath', 'Cause of death')}
                  value={cause}
                  onChange={(event) => setCause(event.target.value)}
                />
              )}
            </>
          )}
        </>
      )}
    </Modal>
  );
}
