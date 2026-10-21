import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Form, InlineLoading, InlineNotification, TextInput, Tile } from '@carbon/react';
import { PatientSearchPictogram, useConfig, useSession } from '@openmrs/esm-framework';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import { type Config } from '../config-schema';
import { openFormInChart } from '../visits/open-form-in-chart';
import { findPatientByActId } from './scan-patient-card.resource';
import { useBarcodeCamera } from './use-barcode-camera';
import styles from './scan-patient-card.scss';

/**
 * Scan the barcode on a patient's identifier sticker, printed by OpenMRS with their ACT ID, or type the ACT ID, and
 * their BPG Delivery form opens in their chart.
 */
export default function ScanPatientCard() {
  const { t } = useTranslation();
  const { actIdentifierType, prophylaxisCard, visitType } = useConfig<Config>();
  const { sessionLocation } = useSession();
  const video = useRef<HTMLVideoElement>(null);
  const [reading, setReading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [actId, setActId] = useState('');
  const [notFound, setNotFound] = useState<string>(null);

  const openBpg = useCallback(
    async (scanned: string) => {
      const id = scanned.trim();
      if (!id) {
        return;
      }
      setOpening(true);
      try {
        const patientUuid = await findPatientByActId(id, actIdentifierType);
        if (!patientUuid) {
          setNotFound(t('noPatientWithActId', 'No patient with ACT ID {{actId}}.', { actId: id }));
          return;
        }
        setNotFound(null);
        await openFormInChart(t, {
          patientUuid,
          formUuid: prophylaxisCard.bpgForm,
          visitType,
          location: sessionLocation?.uuid,
        });
      } catch (e) {
        setNotFound(e?.message);
      } finally {
        setOpening(false);
      }
    },
    [t, actIdentifierType, prophylaxisCard.bpgForm, visitType, sessionLocation?.uuid],
  );

  const onRead = useCallback(
    (text: string) => {
      setReading(false);
      openBpg(text);
    },
    [openBpg],
  );
  const cameraError = useBarcodeCamera(video, reading, onRead);

  const openTyped = (event: React.FormEvent) => {
    event.preventDefault();
    openBpg(actId);
  };

  return (
    <>
      <ActPageHeader title={t('scanPatientCard', 'Scan patient card')} illustration={<PatientSearchPictogram />} />
      <div className={styles.page}>
        <Tile className={styles.tile}>
          <p className={styles.explanation}>
            {t(
              'scanPatientCardExplanation',
              "Point the camera at the barcode on the patient's identifier sticker to open their BPG Delivery form in their chart. The ACT ID field also takes a handheld barcode scanner.",
            )}
          </p>
          <Button kind={reading ? 'secondary' : 'primary'} disabled={opening} onClick={() => setReading(!reading)}>
            {reading ? t('stopScanning', 'Stop scanning') : t('startScanning', 'Start scanning')}
          </Button>
          <video ref={video} className={styles.video} hidden={!reading || Boolean(cameraError)} muted playsInline />
          {reading && cameraError && (
            <InlineNotification
              kind="warning"
              lowContrast
              hideCloseButton
              title={t('cameraUnavailable', 'The camera is not available')}
              subtitle={t('typeActIdInstead', 'Type the ACT ID instead. {{reason}}', { reason: cameraError.message })}
            />
          )}
          <Form className={styles.typed} onSubmit={openTyped}>
            {/* Focused on arrival, so a handheld scanner's ACT ID and Enter land here without a click. */}
            <TextInput
              autoFocus
              id="act-scan-patient-card-act-id"
              labelText={t('actId', 'ACT ID')}
              placeholder="rhd00001"
              value={actId}
              onChange={(event) => setActId(event.target.value)}
            />
            <Button type="submit" kind="tertiary" disabled={opening || !actId.trim()}>
              {t('openBpgForm', 'Open BPG form')}
            </Button>
          </Form>
          {opening && <InlineLoading description={t('openingBpgForm', 'Opening the BPG form')} />}
          {notFound && (
            <InlineNotification
              kind="error"
              lowContrast
              title={t('couldNotOpenForm', 'Could not open the form')}
              subtitle={notFound}
              onClose={() => setNotFound(null)}
            />
          )}
        </Tile>
      </div>
    </>
  );
}
