import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ButtonSet, Form, InlineNotification, Select, SelectItem, TextInput } from '@carbon/react';
import { showSnackbar, useConfig, Workspace2, type Workspace2DefinitionProps } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { RecordLoading } from '../record-loading.component';
import { restErrorMessage } from '../rest-error-message';
import { useClinicText } from './clinic-text';
import {
  type Clinic,
  type ClinicForm,
  MissingLocationTags,
  saveClinic,
  useClinics,
  useLocationTags,
} from './clinics.resource';
import formStyles from '../styles/form-workspace.scss';
import styles from './clinics.scss';

export interface ClinicFormWorkspaceProps {
  /** The clinic to edit; a new one is added when absent. */
  clinicUuid?: string;
}

interface ClinicFormBodyProps {
  clinic?: Clinic;
  clinics: Array<Clinic>;
  mutate: () => unknown;
  closeWorkspace: Workspace2DefinitionProps['closeWorkspace'];
}

function ClinicFormBody({ clinic, clinics, mutate, closeWorkspace }: ClinicFormBodyProps) {
  const { t } = useTranslation();
  const { clinics: config, clinicLocationTags } = useConfig<Config>();
  const { tagUuids, error: tagsError } = useLocationTags();
  const { levelText, typeText } = useClinicText();
  const [form, setForm] = useState<ClinicForm>({
    name: clinic?.name ?? '',
    type: clinic?.type ?? '',
    level: clinic?.level ?? '',
    parent: clinic?.parentLocation?.uuid ?? '',
    enabled: !clinic?.retired,
  });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const change = (field: Partial<ClinicForm>) => {
    setDirty(true);
    setForm((current) => ({ ...current, ...field }));
  };
  const types = [...config.types, ...(clinic?.type && !config.types.includes(clinic.type) ? [clinic.type] : [])];
  // As in ACT 2.0, a parent is a cardiac clinic: a level whose tag is in clinicLocationTags.cardiac.
  const parentLevels = config.levels
    .filter(({ tag }) => clinicLocationTags.cardiac.includes(tag))
    .map(({ level }) => level);
  const parents = clinics.filter(
    (other) =>
      other.uuid !== clinic?.uuid &&
      ((parentLevels.includes(other.level) && !other.retired) || other.uuid === form.parent),
  );
  const otherParent = parents.some(({ uuid }) => uuid === clinic?.parentLocation?.uuid) ? null : clinic?.parentLocation;
  const missing = {
    name: !form.name.trim(),
    level: !form.level,
    type: !form.type,
  };

  const submit = async () => {
    setSubmitted(true);
    if (Object.values(missing).some(Boolean) || !tagUuids) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await saveClinic(form, config, tagUuids, clinic);
      showSnackbar({ kind: 'success', title: t('clinicSaved', 'Clinic saved') });
      mutate();
      closeWorkspace({ discardUnsavedChanges: true });
    } catch (e) {
      setSaveError(
        e instanceof MissingLocationTags
          ? t('missingLocationTags', 'The server has no location tag named {{tags}}; ask an administrator to add it', {
              tags: e.tags.join(', '),
              interpolation: { escapeValue: false },
            })
          : restErrorMessage(e),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Workspace2
      title={
        clinic
          ? t('editClinicNamed', 'Edit {{name}}', { name: clinic.name, interpolation: { escapeValue: false } })
          : t('addClinic', 'Add clinic')
      }
      hasUnsavedChanges={dirty}
    >
      <Form className={formStyles.form} onSubmit={(event) => event.preventDefault()}>
        <div className={formStyles.fields}>
          {tagsError && (
            <InlineNotification
              kind="error"
              statusIconDescription={t('errorIcon', 'error icon')}
              lowContrast
              hideCloseButton
              title={t('couldNotLoadLocationTags', 'Could not load the location tags, so the clinic cannot be saved')}
              subtitle={restErrorMessage(tagsError)}
            />
          )}
          {saveError && (
            <InlineNotification
              kind="error"
              statusIconDescription={t('errorIcon', 'error icon')}
              lowContrast
              hideCloseButton
              title={t('couldNotSaveClinic', 'Could not save the clinic')}
              subtitle={saveError}
            />
          )}
          <div className={styles.form}>
            <TextInput
              id="clinic-name"
              labelText={t('name', 'Name')}
              value={form.name}
              invalid={submitted && missing.name}
              invalidText={t('enterClinicName', 'Enter the clinic name')}
              onChange={(event) => change({ name: event.target.value })}
            />
            <Select
              id="clinic-level"
              labelText={t('level', 'Level')}
              value={form.level}
              invalid={submitted && missing.level}
              invalidText={t('chooseClinicLevel', 'Choose the clinic level')}
              onChange={(event) => change({ level: event.target.value })}
            >
              <SelectItem value="" text={t('chooseLevel', 'Choose a level')} disabled />
              {config.levels.map(({ level }) => (
                <SelectItem key={level} value={level} text={levelText(level)} />
              ))}
            </Select>
            <Select
              id="clinic-type"
              labelText={t('type', 'Type')}
              value={form.type}
              invalid={submitted && missing.type}
              invalidText={t('chooseClinicType', 'Choose the clinic type')}
              onChange={(event) => change({ type: event.target.value })}
            >
              <SelectItem value="" text={t('chooseType', 'Choose a type')} disabled />
              {types.map((type) => (
                <SelectItem key={type} value={type} text={typeText(type)} />
              ))}
            </Select>
            <Select
              id="clinic-parent"
              labelText={t('parentClinic', 'Parent clinic')}
              value={form.parent}
              onChange={(event) => change({ parent: event.target.value })}
            >
              <SelectItem value="" text={t('none', 'None')} />
              {parents.map((parent) => (
                <SelectItem key={parent.uuid} value={parent.uuid} text={parent.name} />
              ))}
              {otherParent && <SelectItem value={otherParent.uuid} text={otherParent.display} />}
            </Select>
            {clinic && (
              <Select
                id="clinic-status"
                labelText={t('status', 'Status')}
                value={form.enabled ? 'enabled' : 'disabled'}
                onChange={(event) => change({ enabled: event.target.value === 'enabled' })}
              >
                <SelectItem value="enabled" text={t('enabled', 'Enabled')} />
                <SelectItem value="disabled" text={t('disabled', 'Disabled')} />
              </Select>
            )}
          </div>
        </div>
        <ButtonSet>
          <Button className={formStyles.button} kind="secondary" onClick={() => closeWorkspace()}>
            {t('cancel', 'Cancel')}
          </Button>
          <Button className={formStyles.button} kind="primary" disabled={saving || !tagUuids} onClick={submit}>
            {saving ? t('saving', 'Saving...') : t('save', 'Save')}
          </Button>
        </ButtonSet>
      </Form>
    </Workspace2>
  );
}

/** Adds a clinic, or edits the one given: its name, level, type, parent and status. */
const ClinicFormWorkspace: React.FC<Workspace2DefinitionProps<ClinicFormWorkspaceProps>> = ({
  workspaceProps,
  closeWorkspace,
}) => {
  const { t } = useTranslation();
  const clinicUuid = workspaceProps?.clinicUuid;
  const { levels } = useConfig<Config>().clinics;
  const { clinics, error, isLoading, mutate } = useClinics(levels);
  const clinic = clinics.find((candidate) => candidate.uuid === clinicUuid);

  if (clinicUuid && !clinic) {
    return (
      <RecordLoading
        title={t('editClinic', 'Edit clinic')}
        settled={Boolean(error) || !isLoading}
        notFound={t('couldNotLoadClinic', 'Could not load this clinic')}
      />
    );
  }
  return <ClinicFormBody clinic={clinic} clinics={clinics} mutate={mutate} closeWorkspace={closeWorkspace} />;
};

export default ClinicFormWorkspace;
