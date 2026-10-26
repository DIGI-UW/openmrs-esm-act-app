import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ButtonSet, Form, InlineNotification, PasswordInput } from '@carbon/react';
import { showSnackbar, Workspace2, type Workspace2DefinitionProps } from '@openmrs/esm-framework';
import { RecordLoading } from '../record-loading.component';
import { restErrorMessage } from '../rest-error-message';
import { type ActUser, fullName, resetPassword, useUsers } from './users.resource';
import formStyles from '../styles/form-workspace.scss';
import styles from './users.scss';

export interface ResetPasswordWorkspaceProps {
  userUuid: string;
}

function ResetPasswordForm({
  user,
  closeWorkspace,
}: {
  user: ActUser;
  closeWorkspace: Workspace2DefinitionProps['closeWorkspace'];
}) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const missing = submitted && !password;
  const mismatch = submitted && password !== confirm;

  const submit = async () => {
    setSubmitted(true);
    if (!password || password !== confirm) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await resetPassword(user, password);
      showSnackbar({ kind: 'success', title: t('passwordReset', 'Password reset') });
      closeWorkspace({ discardUnsavedChanges: true });
    } catch (e) {
      setSaveError(restErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Workspace2
      title={t('resetPasswordFor', 'Reset the password of {{name}}', { name: fullName(user) || user.username })}
      hasUnsavedChanges={Boolean(password || confirm)}
    >
      <Form className={formStyles.form} onSubmit={(event) => event.preventDefault()}>
        <div className={`${formStyles.fields} ${styles.form}`}>
          {saveError && (
            <InlineNotification
              kind="error"
              statusIconDescription={t('errorIcon', 'error icon')}
              lowContrast
              hideCloseButton
              title={t('couldNotResetPassword', 'Could not reset the password')}
              subtitle={saveError}
            />
          )}
          <PasswordInput
            showPasswordLabel={t('showPassword', 'Show password')}
            hidePasswordLabel={t('hidePassword', 'Hide password')}
            id="reset-password"
            labelText={t('newPassword', 'New password')}
            helperText={t('passwordRule', 'At least 8 characters, with an upper case letter and a number')}
            value={password}
            invalid={missing}
            invalidText={t('enterPassword', 'Enter a password')}
            onChange={(event) => setPassword(event.target.value)}
          />
          <PasswordInput
            showPasswordLabel={t('showPassword', 'Show password')}
            hidePasswordLabel={t('hidePassword', 'Hide password')}
            id="reset-password-confirm"
            labelText={t('confirmPassword', 'Confirm password')}
            value={confirm}
            invalid={!missing && mismatch}
            invalidText={t('passwordsDoNotMatch', 'The passwords do not match')}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </div>
        <ButtonSet>
          <Button className={formStyles.button} kind="secondary" onClick={() => closeWorkspace()}>
            {t('cancel', 'Cancel')}
          </Button>
          <Button className={formStyles.button} kind="primary" disabled={saving} onClick={submit}>
            {saving ? t('saving', 'Saving...') : t('resetPassword', 'Reset password')}
          </Button>
        </ButtonSet>
      </Form>
    </Workspace2>
  );
}

/** Sets a new password for a user, which needs Edit User Passwords. */
const ResetPasswordWorkspace: React.FC<Workspace2DefinitionProps<ResetPasswordWorkspaceProps>> = ({
  workspaceProps,
  closeWorkspace,
}) => {
  const { t } = useTranslation();
  const { users, error, isLoading } = useUsers();
  const user = users.find((candidate) => candidate.uuid === workspaceProps.userUuid);
  const disabled = Boolean(user?.retired);

  // Disabling the user closes the form, as the modal kept the two apart.
  useEffect(() => {
    if (disabled) {
      closeWorkspace({ discardUnsavedChanges: true });
    }
  }, [disabled, closeWorkspace]);

  if (!user) {
    return (
      <RecordLoading
        title={t('resetPassword', 'Reset password')}
        settled={Boolean(error) || !isLoading}
        notFound={t('couldNotLoadUser', 'Could not load this user')}
      />
    );
  }
  return <ResetPasswordForm user={user} closeWorkspace={closeWorkspace} />;
};

export default ResetPasswordWorkspace;
