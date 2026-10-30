import React, { useState } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';
import { Button, InlineNotification, Select, SelectItem, TextInput } from '@carbon/react';
import { restBaseUrl, showSnackbar, useConfig, useSession } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { saveInr, type InrEntry } from './inr-edit.resource';
import styles from './inr-edit-panel.scss';

const highest = 99;

/**
 * The INR entry as a panel under the consultation form's chart, edited or recorded in place. It saves straight to the
 * server, apart from the consultation's Save, and keeps Enter and Escape from reaching the consultation's form.
 */
export default function InrEditPanel({
  patientUuid,
  entry,
  mode,
  onClose,
}: {
  patientUuid: string;
  entry: InrEntry | null;
  mode: 'edit' | 'record';
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { inrReviews } = useConfig<Config>();
  const { sessionLocation } = useSession();
  const { mutate } = useSWRConfig();
  const editing = mode === 'edit' ? entry : null;
  const [dateTested, setDateTested] = useState(editing?.dateTested || dayjs().format('YYYY-MM-DD'));
  const [inr, setInr] = useState(editing?.inr === null || !editing ? '' : String(editing.inr));
  const [doseChange, setDoseChange] = useState(editing?.doseChange ?? '');
  const [newDose, setNewDose] = useState(editing?.newDose ?? '');
  const [target, setTarget] = useState(entry?.target?.valueUuid ?? '');
  const [nextInr, setNextInr] = useState(editing?.next?.value ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Every entry of an INR Monitoring shares its one target and next INR date.
  const shared = Boolean(editing && editing.groupCount > 1);
  const { yes, no, targets } = inrReviews.answers;

  const value = Number(inr);
  const inrInvalid = !inr.trim() || !Number.isFinite(value) || value <= 0 || value > highest;
  const dateInvalid = !dateTested;

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
        encounterType: inrReviews.encounterType,
        location: sessionLocation?.uuid,
        concepts: inrReviews.concepts,
        entry: editing,
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
      setError(e?.responseBody?.error?.message ?? e?.message ?? t('couldNotSaveInr', 'The INR could not be saved'));
      setSaving(false);
      return;
    }
    showSnackbar({ kind: 'success', title: t('inrSaved', 'INR saved') });
    await mutate((key) => typeof key === 'string' && key.startsWith(`${restBaseUrl}/encounter?patient=${patientUuid}`));
    onClose();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      onClose();
    } else if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault();
    }
  };

  return (
    <div className={styles.panel} role="group" aria-label={t('inrEditor', 'INR monitoring')} onKeyDown={onKeyDown}>
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
        <SelectItem value="" text="" />
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
      <div className={styles.actions}>
        <Button type="button" kind="primary" size="sm" disabled={saving} onClick={save}>
          {t('save', 'Save')}
        </Button>
        <Button type="button" kind="ghost" size="sm" disabled={saving} onClick={onClose}>
          {t('cancel', 'Cancel')}
        </Button>
      </div>
    </div>
  );
}
