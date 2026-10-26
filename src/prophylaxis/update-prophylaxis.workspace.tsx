import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import dayjs from 'dayjs';
import {
  Button,
  ButtonSet,
  Checkbox,
  InlineLoading,
  InlineNotification,
  Select,
  SelectItem,
  TextInput,
} from '@carbon/react';
import {
  formatDate,
  parseDate,
  restBaseUrl,
  showSnackbar,
  useConfig,
  useSession,
  Workspace2,
  type Workspace2DefinitionProps,
} from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { restErrorMessage } from '../rest-error-message';
import { type CurrentPrescription, savePrescription, usePrescription } from './prescription.resource';
import styles from './update-prophylaxis.scss';

const day = (value: string) => formatDate(parseDate(value), { time: false });

type WorkspaceProps = Workspace2DefinitionProps<object, object, { patientUuid: string }>;

function UpdateForm({
  patientUuid,
  prescription,
  closeWorkspace,
}: {
  patientUuid: string;
  prescription: CurrentPrescription | null;
  closeWorkspace: WorkspaceProps['closeWorkspace'];
}) {
  const { t } = useTranslation();
  const { prophylaxisUpdate } = useConfig<Config>();
  const { sessionLocation } = useSession();
  const { mutate } = useSWRConfig();
  const today = dayjs().format('YYYY-MM-DD');
  // The last-started prescription in force, which this edits; any others are carried as they are.
  const main = prescription?.main ?? null;
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
        subtitle: t('prophylaxisNeedsLocation', 'Choose a login location first'),
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
          regimen: stopping && main ? main.regimen : chosen,
          started: stopping && main ? main.started : started,
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
    closeWorkspace({ discardUnsavedChanges: true });
  };

  const unsaved =
    regimen !== (main?.regimen.uuid ?? '') ||
    started !== (main?.started ?? today) ||
    duration !== (prescription?.duration?.uuid ?? '') ||
    stopping;

  return (
    <Workspace2 title={t('updateProphylaxis', 'Update prophylaxis')} hasUnsavedChanges={unsaved}>
      <div className={styles.form}>
        <div className={styles.body}>
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
        </div>
        <ButtonSet className={styles.footer}>
          <Button className={styles.button} kind="secondary" disabled={saving} onClick={() => closeWorkspace()}>
            {t('cancel', 'Cancel')}
          </Button>
          <Button className={styles.button} kind="primary" disabled={!valid} onClick={save}>
            {stopping ? t('stopProphylaxis', 'Stop prophylaxis') : t('save', 'Save')}
          </Button>
        </ButtonSet>
      </div>
    </Workspace2>
  );
}

/** Update prophylaxis, which changes the regimen or stops it, without a consultation. */
export default function UpdateProphylaxisWorkspace({ closeWorkspace, groupProps: { patientUuid } }: WorkspaceProps) {
  const { t } = useTranslation();
  const { prophylaxisUpdate } = useConfig<Config>();
  const { prescription, isLoading } = usePrescription(patientUuid, prophylaxisUpdate.concepts);

  return isLoading ? (
    <Workspace2 title={t('updateProphylaxis', 'Update prophylaxis')}>
      <InlineLoading className={styles.body} description={t('loading', 'Loading...')} />
    </Workspace2>
  ) : (
    <UpdateForm patientUuid={patientUuid} prescription={prescription} closeWorkspace={closeWorkspace} />
  );
}
