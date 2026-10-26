import React, { useState } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import {
  Button,
  ButtonSet,
  Form,
  InlineLoading,
  InlineNotification,
  Select,
  SelectItem,
  Stack,
  TextInput,
} from '@carbon/react';
import {
  OpenmrsDatePicker,
  parseDate,
  showSnackbar,
  useConfig,
  Workspace2,
  type Workspace2DefinitionProps,
} from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { restErrorMessage } from '../rest-error-message';
import { type Study } from '../studies/studies.resource';
import {
  activeStudyUuids,
  type EnrollmentInput,
  saveEnrollment,
  type StudyEnrollment,
  useStudyEnrollments,
} from './research.resource';
import styles from '../styles/form-workspace.scss';

const day = (date: Date | null) => (date ? dayjs(date).format('YYYY-MM-DD') : null);
const toDate = (value: string | null) => (value ? parseDate(value) : null);

export interface EnrollmentWorkspaceProps {
  patientUuid: string;
  /** The enrolment to edit; a new one when absent. */
  enrollmentUuid?: string;
}

interface EnrollmentFormProps {
  patientUuid: string;
  /** The studies a new enrolment may be in: those the patient is not active in. */
  studies: Array<Study>;
  /** The enrolment to edit, as last loaded; a new one when absent. */
  enrollment?: StudyEnrollment;
  mutate: () => unknown;
  closeWorkspace: Workspace2DefinitionProps['closeWorkspace'];
}

function EnrollmentForm({ patientUuid, studies, enrollment, mutate, closeWorkspace }: EnrollmentFormProps) {
  const { t } = useTranslation();
  const { studyParticipantIdAttributeType } = useConfig<Config>().studies;
  const [studyUuid, setStudyUuid] = useState(enrollment?.study.uuid ?? '');
  const study = enrollment?.study ?? studies.find((s) => s.uuid === studyUuid);
  const [studyId, setStudyId] = useState(enrollment?.studyId ?? '');
  const [dateEnrolled, setDateEnrolled] = useState<Date | null>(toDate(enrollment?.dateEnrolled ?? null));
  const [stateUuid, setStateUuid] = useState(enrollment?.stateUuid ?? '');
  const [dateCompleted, setDateCompleted] = useState<Date | null>(toDate(enrollment?.dateCompleted ?? null));
  const [dirty, setDirty] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Reopening a completed enrolment leaves it with no open status.
  const states = (study?.states ?? []).filter((s) => !enrollment?.dateCompleted || s.terminal);
  const state = states.find((s) => s.uuid === stateUuid);
  const today = dayjs().endOf('day').toDate();
  const errors = {
    study: !study ? t('chooseAStudy', 'Choose a study') : null,
    studyId: !studyId.trim() ? t('enterTheStudyId', 'Enter the Study ID') : null,
    dateEnrolled: !dateEnrolled
      ? t('enterTheEnrollmentDate', 'Enter the enrollment date')
      : dateEnrolled > today
        ? t('dateNotInFuture', 'The date cannot be in the future')
        : null,
    state: !state ? t('chooseAStatus', 'Choose a status') : null,
    dateCompleted: !state?.terminal
      ? null
      : !dateCompleted
        ? t('enterTheCompletionDate', 'Enter the completion date for an Inactive status')
        : dateCompleted > today
          ? t('dateNotInFuture', 'The date cannot be in the future')
          : dateEnrolled && dayjs(dateCompleted).isBefore(dateEnrolled, 'day')
            ? t('completionNotBeforeEnrollment', 'The completion date cannot be before the enrollment date')
            : null,
  };
  const shown = (key: keyof typeof errors) => (submitted ? errors[key] : null);
  const edited =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      setDirty(true);
      set(value);
    };

  const submit = async () => {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) {
      return;
    }
    const input: EnrollmentInput = {
      studyUuid: study.uuid,
      studyId: studyId.trim(),
      dateEnrolled: day(dateEnrolled),
      stateUuid,
      dateCompleted: state.terminal ? day(dateCompleted) : null,
    };
    setSaving(true);
    setSaveError(null);
    try {
      await saveEnrollment(patientUuid, input, studyParticipantIdAttributeType, enrollment);
      showSnackbar({ kind: 'success', title: t('participationSaved', 'Participation saved') });
      mutate();
      closeWorkspace({ discardUnsavedChanges: true });
    } catch (e) {
      setSaveError(restErrorMessage(e));
      // Some requests may have saved before the failure, so a retry is planned from the reloaded enrolment.
      mutate();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Workspace2
      title={enrollment ? t('editParticipation', 'Edit participation') : t('addParticipation', 'Add participation')}
      hasUnsavedChanges={dirty}
    >
      <Form className={styles.form} onSubmit={(event) => event.preventDefault()}>
        <Stack gap={5} className={styles.fields}>
          {saveError && (
            <InlineNotification
              kind="error"
              statusIconDescription={t('errorIcon', 'error icon')}
              lowContrast
              hideCloseButton
              title={t('couldNotSaveParticipation', 'Could not save the participation')}
              subtitle={saveError}
            />
          )}
          {enrollment ? (
            <TextInput id="enrollment-study" labelText={t('study', 'Study')} value={enrollment.study.name} readOnly />
          ) : (
            <Select
              id="enrollment-study"
              labelText={t('study', 'Study')}
              value={studyUuid}
              invalid={!!shown('study')}
              invalidText={shown('study')}
              onChange={(event) => {
                setDirty(true);
                setStudyUuid(event.target.value);
                const chosen = studies.find((s) => s.uuid === event.target.value);
                setStateUuid(chosen?.states.find((s) => s.initial)?.uuid ?? '');
              }}
            >
              <SelectItem value="" text={t('chooseAStudy', 'Choose a study')} />
              {studies.map((s) => (
                <SelectItem key={s.uuid} value={s.uuid} text={s.name} />
              ))}
            </Select>
          )}
          <TextInput
            id="enrollment-study-id"
            labelText={t('studyId', 'Study ID')}
            value={studyId}
            invalid={!!shown('studyId')}
            invalidText={shown('studyId')}
            onChange={(event) => edited(setStudyId)(event.target.value)}
          />
          <OpenmrsDatePicker
            id="enrollment-date"
            labelText={t('enrollmentDate', 'Enrollment date')}
            value={dateEnrolled}
            maxDate={today}
            invalid={!!shown('dateEnrolled')}
            invalidText={shown('dateEnrolled')}
            onChange={(date) => edited(setDateEnrolled)(date ?? null)}
          />
          <Select
            id="enrollment-status"
            labelText={t('studyStatus', 'Study status')}
            value={stateUuid}
            disabled={!study}
            invalid={!!shown('state')}
            invalidText={shown('state')}
            onChange={(event) => edited(setStateUuid)(event.target.value)}
          >
            <SelectItem value="" text={t('chooseAStatus', 'Choose a status')} />
            {states.map((s) => (
              <SelectItem key={s.uuid} value={s.uuid} text={s.name} />
            ))}
          </Select>
          {state?.terminal && (
            <OpenmrsDatePicker
              id="enrollment-completion-date"
              labelText={t('completionDate', 'Completion date')}
              value={dateCompleted}
              minDate={dateEnrolled ?? undefined}
              maxDate={today}
              invalid={!!shown('dateCompleted')}
              invalidText={shown('dateCompleted')}
              onChange={(date) => edited(setDateCompleted)(date ?? null)}
            />
          )}
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

/**
 * Adds or edits a participation, as ACT 2.0's Participation dialog: study, Study ID and status are required, no date
 * is in the future, and an Inactive status takes a completion date, not before enrolment.
 */
const EnrollmentWorkspace: React.FC<Workspace2DefinitionProps<EnrollmentWorkspaceProps>> = ({
  workspaceProps,
  closeWorkspace,
}) => {
  const { t } = useTranslation();
  const { patientUuid, enrollmentUuid } = workspaceProps;
  const { enrollments, studies, mutate } = useStudyEnrollments(patientUuid);
  const enrollment = enrollments.find((candidate) => candidate.uuid === enrollmentUuid);

  if (enrollmentUuid && !enrollment) {
    return (
      <Workspace2 title={t('editParticipation', 'Edit participation')}>
        <InlineLoading description={t('loading', 'Loading...')} />
      </Workspace2>
    );
  }
  const activeIn = activeStudyUuids(enrollments);
  return (
    <EnrollmentForm
      patientUuid={patientUuid}
      studies={studies.filter((study) => !activeIn.has(study.uuid))}
      enrollment={enrollment}
      mutate={mutate}
      closeWorkspace={closeWorkspace}
    />
  );
};

export default EnrollmentWorkspace;
