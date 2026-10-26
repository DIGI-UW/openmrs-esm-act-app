import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ButtonSet, Form, InlineLoading, InlineNotification, Stack, TextInput } from '@carbon/react';
import { showSnackbar, useConfig, Workspace2, type Workspace2DefinitionProps } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { useReportDataset } from '../reports/report-dataset.resource';
import { restErrorMessage } from '../rest-error-message';
import { saveStudy, type Study, useStudies } from './studies.resource';
import styles from '../styles/form-workspace.scss';

export interface StudyFormWorkspaceProps {
  /** The study to rename; a new one is created when absent. */
  studyUuid?: string;
  /** Called after a rename, so the page can follow the study's new name. */
  onRenamed?: (from: string, to: string) => void;
}

interface StudyFormProps {
  study?: Study;
  onRenamed?: StudyFormWorkspaceProps['onRenamed'];
  closeWorkspace: Workspace2DefinitionProps['closeWorkspace'];
}

function StudyForm({ study, onRenamed, closeWorkspace }: StudyFormProps) {
  const { t } = useTranslation();
  const { participantsReport } = useConfig<Config>().studies;
  const { mutate: reloadStudies } = useStudies();
  const { mutate: reloadParticipants } = useReportDataset(participantsReport);
  const [name, setName] = useState(study?.name ?? '');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const invalid = submitted && !name.trim();

  const submit = async () => {
    setSubmitted(true);
    if (!name.trim()) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await saveStudy(name.trim(), study?.uuid);
      showSnackbar({ kind: 'success', title: t('studySaved', 'Study saved') });
      reloadStudies();
      // The participants' rows carry the study's name.
      reloadParticipants();
      if (study) {
        onRenamed?.(study.name, name.trim());
      }
      closeWorkspace({ discardUnsavedChanges: true });
    } catch (e) {
      setSaveError(restErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Workspace2
      title={study ? t('renameStudy', 'Rename study') : t('createStudy', 'Create study')}
      hasUnsavedChanges={name !== (study?.name ?? '')}
    >
      <Form className={styles.form} onSubmit={(event) => event.preventDefault()}>
        <Stack gap={5} className={styles.fields}>
          {saveError && (
            <InlineNotification
              kind="error"
              statusIconDescription={t('errorIcon', 'error icon')}
              lowContrast
              hideCloseButton
              title={t('couldNotSaveStudy', 'Could not save the study')}
              subtitle={saveError}
            />
          )}
          <TextInput
            id="study-name"
            labelText={t('studyName', 'Study name')}
            value={name}
            invalid={invalid}
            invalidText={t('enterAStudyName', 'Enter a name for the study')}
            onChange={(event) => setName(event.target.value)}
          />
        </Stack>
        <ButtonSet>
          <Button className={styles.button} kind="secondary" onClick={() => closeWorkspace()}>
            {t('cancel', 'Cancel')}
          </Button>
          <Button className={styles.button} kind="primary" disabled={saving} onClick={submit}>
            {saving ? t('saving', 'Saving...') : t('save', 'Save')}
          </Button>
        </ButtonSet>
      </Form>
    </Workspace2>
  );
}

/** Creates a study, or renames the one given. */
const StudyFormWorkspace: React.FC<Workspace2DefinitionProps<StudyFormWorkspaceProps>> = ({
  workspaceProps,
  closeWorkspace,
}) => {
  const { t } = useTranslation();
  const { studyUuid, onRenamed } = workspaceProps ?? {};
  const { studies } = useStudies();
  const study = studies.find((candidate) => candidate.uuid === studyUuid);

  if (studyUuid && !study) {
    return (
      <Workspace2 title={t('renameStudy', 'Rename study')}>
        <InlineLoading description={t('loading', 'Loading...')} />
      </Workspace2>
    );
  }
  return <StudyForm study={study} onRenamed={onRenamed} closeWorkspace={closeWorkspace} />;
};

export default StudyFormWorkspace;
