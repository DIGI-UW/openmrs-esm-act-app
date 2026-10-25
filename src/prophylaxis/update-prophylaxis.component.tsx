import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWRImmutable from 'swr/immutable';
import { useSWRConfig } from 'swr';
import dayjs from 'dayjs';
import { Button, Checkbox, InlineNotification, Modal, Select, SelectItem, TextInput } from '@carbon/react';
import {
  EditIcon,
  formatDate,
  openmrsFetch,
  parseDate,
  restBaseUrl,
  showSnackbar,
  useConfig,
  useSession,
  userHasAccess,
} from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { PRIVILEGE_ADD_ENCOUNTERS } from '../constants';
import { restErrorMessage } from '../rest-error-message';
import { type CurrentPrescription, savePrescription, usePrescription } from './prescription.resource';
import styles from './update-prophylaxis.scss';

const day = (value: string) => formatDate(parseDate(value), { time: false });

/** Whether the user holds Add Encounters and the edit privilege of the encounter type that Update prophylaxis saves. */
function useMayUpdateProphylaxis() {
  const { user } = useSession();
  const { prophylaxisUpdate } = useConfig<Config>();
  const { data: encounterType } = useSWRImmutable(['act-encounter-type', prophylaxisUpdate.encounterType], () =>
    openmrsFetch<{ editPrivilege?: { display: string } | null }>(
      `${restBaseUrl}/encountertype/${prophylaxisUpdate.encounterType}?v=custom:(uuid,editPrivilege:(display))`,
    ).then((response) => response.data),
  );
  return (
    Boolean(user && encounterType) &&
    userHasAccess([PRIVILEGE_ADD_ENCOUNTERS, encounterType?.editPrivilege?.display].filter(Boolean), user!)
  );
}

function UpdateModal({
  patientUuid,
  prescription,
  onClose,
}: {
  patientUuid: string;
  prescription: CurrentPrescription | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { prophylaxisUpdate } = useConfig<Config>();
  const { sessionLocation } = useSession();
  const { mutate } = useSWRConfig();
  const today = dayjs().format('YYYY-MM-DD');
  // The prescription in force that this edits; any others are carried as they are.
  const main = prescription?.groups[0] ?? null;
  const [regimen, setRegimen] = useState(main?.regimen.uuid ?? '');
  const [started, setStarted] = useState(main?.started ?? today);
  const [duration, setDuration] = useState(prescription?.duration?.uuid ?? '');
  const [stopping, setStopping] = useState(false);
  const [stopped, setStopped] = useState(today);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const regimens =
    main && !prophylaxisUpdate.regimens.some((one) => one.uuid === main.regimen.uuid)
      ? [main.regimen, ...prophylaxisUpdate.regimens]
      : prophylaxisUpdate.regimens;
  const chosen = regimens.find((one) => one.uuid === regimen);
  const valid =
    Boolean(chosen && started) && (!stopping || Boolean(stopped && reason && stopped >= started)) && !saving;

  const chooseRegimen = (uuid: string) => {
    setRegimen(uuid);
    // A changed regimen starts today, as ACT Core dates a prescription by its start.
    setStarted(main && uuid === main.regimen.uuid ? main.started : today);
  };

  const save = async () => {
    if (!chosen || !sessionLocation?.uuid) {
      showSnackbar({
        kind: 'error',
        title: t('prophylaxisNotUpdated', 'The prophylaxis could not be updated'),
        subtitle: t('referralNeedsLocation', 'Choose a login location first'),
      });
      return;
    }
    setSaving(true);
    try {
      await savePrescription({
        patient: patientUuid,
        location: sessionLocation.uuid,
        encounterType: prophylaxisUpdate.encounterType,
        concepts: prophylaxisUpdate.concepts,
        current: prescription,
        edit: {
          regimen: chosen,
          started,
          duration: duration || undefined,
          stop: stopping ? { stopped, reason } : undefined,
        },
        main: main?.uuid ?? null,
        today,
      });
    } catch (e) {
      showSnackbar({
        kind: 'error',
        title: t('prophylaxisNotUpdated', 'The prophylaxis could not be updated'),
        subtitle: restErrorMessage(e),
      });
      setSaving(false);
      return;
    }
    showSnackbar({
      kind: 'success',
      title: stopping ? t('prophylaxisStopped', 'Prophylaxis stopped') : t('prophylaxisUpdated', 'Prophylaxis updated'),
    });
    // ACT Core recomputes on save, so every read under the patient's encounters reloads.
    const encounters = `${restBaseUrl}/encounter?patient=${patientUuid}`;
    await mutate((key) => typeof key === 'string' && key.startsWith(encounters));
    onClose();
  };

  return (
    <Modal
      open
      size="sm"
      modalHeading={t('updateProphylaxis', 'Update prophylaxis')}
      primaryButtonText={stopping ? t('stopProphylaxis', 'Stop prophylaxis') : t('save', 'Save')}
      secondaryButtonText={t('cancel', 'Cancel')}
      primaryButtonDisabled={!valid}
      onRequestSubmit={save}
      onRequestClose={onClose}
      onSecondarySubmit={onClose}
    >
      <dl className={styles.current} data-testid="current-prescription">
        <div>
          <dt>{t('currentRegimen', 'Current regimen')}</dt>
          <dd>{main ? main.regimen.label : t('noPrescription', 'No prescription')}</dd>
        </div>
        <div>
          <dt>{t('started', 'Started')}</dt>
          <dd>{main ? day(main.started) : '--'}</dd>
        </div>
        <div>
          <dt>{t('duration', 'Duration')}</dt>
          <dd>{prescription?.duration?.label || '--'}</dd>
        </div>
      </dl>
      {prescription?.day === today && (
        <InlineNotification
          kind="info"
          lowContrast
          hideCloseButton
          title={t('recordedToday', 'Recorded today')}
          subtitle={t(
            'recordedTodayExplanation',
            "ACT counts only the first record of a day, so this changes today's record instead of adding another.",
          )}
        />
      )}
      <Select
        id="update-prophylaxis-regimen"
        labelText={t('regimen', 'Regimen')}
        value={regimen}
        onChange={(event) => chooseRegimen(event.target.value)}
      >
        <SelectItem value="" text={t('chooseRegimen', 'Choose a regimen')} />
        {regimens.map((one) => (
          <SelectItem key={one.uuid} value={one.uuid} text={one.label} />
        ))}
      </Select>
      <TextInput
        id="update-prophylaxis-started"
        type="date"
        labelText={t('dateStarted', 'Date started')}
        value={started}
        onChange={(event) => setStarted(event.target.value)}
      />
      <Select
        id="update-prophylaxis-duration"
        labelText={t('duration', 'Duration')}
        value={duration}
        onChange={(event) => setDuration(event.target.value)}
      >
        <SelectItem value="" text={t('notRecorded', 'Not recorded')} />
        {prophylaxisUpdate.durations.map((one) => (
          <SelectItem key={one.uuid} value={one.uuid} text={one.label} />
        ))}
      </Select>
      {main && (
        <Checkbox
          id="update-prophylaxis-stop"
          labelText={t('stopProphylaxisLabel', 'Stop this prophylaxis')}
          checked={stopping}
          onChange={(_, { checked }) => setStopping(checked)}
        />
      )}
      {stopping && (
        <>
          <TextInput
            id="update-prophylaxis-stopped"
            type="date"
            labelText={t('dateStopped', 'Date stopped')}
            value={stopped}
            min={started}
            onChange={(event) => setStopped(event.target.value)}
          />
          <Select
            id="update-prophylaxis-reason"
            labelText={t('reasonStopped', 'Reason stopped')}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          >
            <SelectItem value="" text={t('chooseReason', 'Choose a reason')} />
            {prophylaxisUpdate.reasons.map((one) => (
              <SelectItem key={one.uuid} value={one.uuid} text={one.label} />
            ))}
          </Select>
        </>
      )}
    </Modal>
  );
}

/** Update prophylaxis, for a user who may record the update encounter: change the regimen or stop it, without a consultation. */
export default function UpdateProphylaxis({ patientUuid }: { patientUuid: string }) {
  const { t } = useTranslation();
  const { prophylaxisUpdate } = useConfig<Config>();
  const may = useMayUpdateProphylaxis();
  const { prescription, isLoading } = usePrescription(patientUuid, prophylaxisUpdate.concepts);
  const [open, setOpen] = useState(false);

  if (!may) {
    return null;
  }
  return (
    <>
      <Button
        kind="ghost"
        size="sm"
        renderIcon={(props) => <EditIcon size={16} {...props} />}
        disabled={isLoading}
        onClick={() => setOpen(true)}
      >
        {t('updateProphylaxis', 'Update prophylaxis')}
      </Button>
      {open && <UpdateModal patientUuid={patientUuid} prescription={prescription} onClose={() => setOpen(false)} />}
    </>
  );
}
