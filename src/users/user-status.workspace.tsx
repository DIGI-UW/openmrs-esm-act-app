import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ButtonSet, Form, InlineNotification } from '@carbon/react';
import { showSnackbar, Workspace2, type Workspace2DefinitionProps } from '@openmrs/esm-framework';
import { RecordLoading } from '../record-loading.component';
import { restErrorMessage } from '../rest-error-message';
import { type ActUser, disableUser, enableUser, fullName, useUsers } from './users.resource';
import formStyles from '../styles/form-workspace.scss';
import styles from './users.scss';

export interface UserStatusWorkspaceProps {
  userUuid: string;
  enable: boolean;
}

function UserStatusForm({
  user,
  enable,
  onSaved,
  closeWorkspace,
}: {
  user: ActUser;
  enable: boolean;
  onSaved: () => void;
  closeWorkspace: Workspace2DefinitionProps['closeWorkspace'];
}) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const name = fullName(user) || user.username;

  const submit = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await (enable ? enableUser(user) : disableUser(user, 'Disabled from the ACT Users page'));
      showSnackbar({
        kind: 'success',
        title: enable ? t('userEnabled', 'User enabled') : t('userDisabled', 'User disabled'),
      });
      onSaved();
      closeWorkspace({ discardUnsavedChanges: true });
    } catch (e) {
      setSaveError(restErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Workspace2
      title={
        enable
          ? t('enableUserNamed', 'Enable {{name}}?', { name })
          : t('disableUserNamed', 'Disable {{name}}?', { name })
      }
    >
      <Form className={formStyles.form} onSubmit={(event) => event.preventDefault()}>
        <div className={`${formStyles.fields} ${styles.form}`}>
          {saveError && (
            <InlineNotification
              kind="error"
              statusIconDescription={t('errorIcon', 'error icon')}
              lowContrast
              hideCloseButton
              title={
                enable
                  ? t('couldNotEnableUser', 'Could not enable the user')
                  : t('couldNotDisableUser', 'Could not disable the user')
              }
              subtitle={saveError}
            />
          )}
          <p>
            {enable
              ? t('enableUserBody', 'They will be able to sign in again.')
              : t(
                  'disableUserBody',
                  'They will no longer be able to sign in. Everything they recorded stays. You can enable them again from this page.',
                )}
          </p>
        </div>
        <ButtonSet>
          <Button className={formStyles.button} kind="secondary" onClick={() => closeWorkspace()}>
            {t('cancel', 'Cancel')}
          </Button>
          <Button className={formStyles.button} kind={enable ? 'primary' : 'danger'} disabled={saving} onClick={submit}>
            {saving ? t('saving', 'Saving...') : enable ? t('enable', 'Enable') : t('disable', 'Disable')}
          </Button>
        </ButtonSet>
      </Form>
    </Workspace2>
  );
}

/** Disables a user, or enables a disabled one, after the administrator confirms. */
const UserStatusWorkspace: React.FC<Workspace2DefinitionProps<UserStatusWorkspaceProps>> = ({
  workspaceProps,
  closeWorkspace,
}) => {
  const { t } = useTranslation();
  const { users, error, isLoading, mutate } = useUsers();
  const user = users.find((candidate) => candidate.uuid === workspaceProps.userUuid);

  if (!user) {
    return (
      <RecordLoading
        title={workspaceProps.enable ? t('enableUser', 'Enable user') : t('disableUser', 'Disable user')}
        settled={Boolean(error) || !isLoading}
        notFound={t('couldNotLoadUser', 'Could not load this user')}
      />
    );
  }
  return <UserStatusForm user={user} enable={workspaceProps.enable} onSaved={mutate} closeWorkspace={closeWorkspace} />;
};

export default UserStatusWorkspace;
