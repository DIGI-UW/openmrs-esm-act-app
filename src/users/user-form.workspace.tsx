import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  ButtonSet,
  Checkbox,
  Form,
  InlineNotification,
  PasswordInput,
  RadioButton,
  RadioButtonGroup,
  TextInput,
} from '@carbon/react';
import { showSnackbar, Workspace2, type Workspace2DefinitionProps } from '@openmrs/esm-framework';
import { RecordLoading } from '../record-loading.component';
import { restErrorMessage } from '../rest-error-message';
import {
  type ActUser,
  clinicsOf,
  roleLabel,
  saveUser,
  type UserForm,
  useClinicChoices,
  useRoleChoices,
  useUsers,
} from './users.resource';
import formStyles from '../styles/form-workspace.scss';
import styles from './users.scss';

export interface UserFormWorkspaceProps {
  /** The user to edit; a new one is added when absent. */
  userUuid?: string;
}

interface UserFormBodyProps {
  user?: ActUser;
  mutate: () => unknown;
  closeWorkspace: Workspace2DefinitionProps['closeWorkspace'];
}

function UserFormBody({ user, mutate, closeWorkspace }: UserFormBodyProps) {
  const { t } = useTranslation();
  const roleChoices = useRoleChoices();
  const clinicChoices = useClinicChoices();
  const [form, setForm] = useState<UserForm>({
    givenName: user?.person?.preferredName?.givenName ?? '',
    familyName: user?.person?.preferredName?.familyName ?? '',
    gender: user?.person?.gender ?? '',
    username: user?.username ?? '',
    password: '',
    roles: user?.roles.map((role) => role.uuid) ?? [],
    clinics: user ? clinicsOf(user) : [],
  });
  const [confirm, setConfirm] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const change = (patch: Partial<UserForm>) => {
    setDirty(true);
    setForm((current) => ({ ...current, ...patch }));
  };
  const toggle = (key: 'roles' | 'clinics', uuid: string, checked: boolean) =>
    change({ [key]: checked ? [...form[key], uuid] : form[key].filter((one) => one !== uuid) });
  // A role the administrator may not give, which an instance administrator gave, stays as it is.
  const offeredRoles = new Set(roleChoices.roles.map((role) => role.uuid));
  const otherRoles = user?.roles.filter((role) => !offeredRoles.has(role.uuid)) ?? [];
  const otherClinics = form.clinics.filter((uuid) => !clinicChoices.some((clinic) => clinic.uuid === uuid));

  const errors = {
    givenName: !form.givenName.trim() && t('enterGivenName', 'Enter a given name'),
    familyName: !form.familyName.trim() && t('enterFamilyName', 'Enter a family name'),
    gender: !user && !form.gender && t('chooseSex', 'Choose a sex'),
    username: !user && !form.username.trim() && t('enterUsername', 'Enter a username'),
    password: !user && !form.password && t('enterPassword', 'Enter a password'),
    confirm: !user && form.password !== confirm && t('passwordsDoNotMatch', 'The passwords do not match'),
    roles: !form.roles.length && t('chooseARole', 'Choose at least one role'),
    clinics: !form.clinics.length && t('chooseAClinic', 'Choose at least one clinic'),
  };
  const shown = (key: keyof typeof errors) => (submitted ? errors[key] || undefined : undefined);

  const submit = async () => {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await saveUser(form, user);
      showSnackbar({ kind: 'success', title: t('userSaved', 'User saved') });
      mutate();
      closeWorkspace({ discardUnsavedChanges: true });
    } catch (e) {
      setSaveError(restErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Workspace2 title={user ? t('editUser', 'Edit user') : t('addUser', 'Add user')} hasUnsavedChanges={dirty}>
      <Form className={formStyles.form} onSubmit={(event) => event.preventDefault()}>
        <div className={`${formStyles.fields} ${styles.form}`}>
          {saveError && (
            <InlineNotification
              kind="error"
              statusIconDescription={t('errorIcon', 'error icon')}
              lowContrast
              hideCloseButton
              title={t('couldNotSaveUser', 'Could not save the user')}
              subtitle={saveError}
            />
          )}
          <div className={styles.pair}>
            <TextInput
              id="user-given-name"
              labelText={t('givenName', 'Given name')}
              value={form.givenName}
              invalid={Boolean(shown('givenName'))}
              invalidText={shown('givenName')}
              onChange={(event) => change({ givenName: event.target.value })}
            />
            <TextInput
              id="user-family-name"
              labelText={t('familyName', 'Family name')}
              value={form.familyName}
              invalid={Boolean(shown('familyName'))}
              invalidText={shown('familyName')}
              onChange={(event) => change({ familyName: event.target.value })}
            />
          </div>
          {!user && (
            <>
              <RadioButtonGroup
                legendText={t('sex', 'Sex')}
                name="user-sex"
                valueSelected={form.gender}
                invalid={Boolean(shown('gender'))}
                invalidText={shown('gender')}
                onChange={(value) => change({ gender: String(value) })}
              >
                <RadioButton id="user-sex-f" labelText={t('female', 'Female')} value="F" />
                <RadioButton id="user-sex-m" labelText={t('male', 'Male')} value="M" />
              </RadioButtonGroup>
              <TextInput
                id="user-username"
                labelText={t('username', 'Username')}
                value={form.username}
                invalid={Boolean(shown('username'))}
                invalidText={shown('username')}
                onChange={(event) => change({ username: event.target.value })}
              />
              <div className={styles.pair}>
                <PasswordInput
                  showPasswordLabel={t('showPassword', 'Show password')}
                  hidePasswordLabel={t('hidePassword', 'Hide password')}
                  id="user-password"
                  labelText={t('password', 'Password')}
                  helperText={t('passwordRule', 'At least 8 characters, with an upper case letter and a number')}
                  value={form.password}
                  invalid={Boolean(shown('password'))}
                  invalidText={shown('password')}
                  onChange={(event) => change({ password: event.target.value })}
                />
                <PasswordInput
                  showPasswordLabel={t('showPassword', 'Show password')}
                  hidePasswordLabel={t('hidePassword', 'Hide password')}
                  id="user-password-confirm"
                  labelText={t('confirmPassword', 'Confirm password')}
                  value={confirm}
                  invalid={Boolean(shown('confirm'))}
                  invalidText={shown('confirm')}
                  onChange={(event) => {
                    setDirty(true);
                    setConfirm(event.target.value);
                  }}
                />
              </div>
            </>
          )}
          <fieldset className={styles.choices}>
            <legend className={styles.legend}>{t('roles', 'Roles')}</legend>
            {roleChoices.error && (
              <InlineNotification
                kind="error"
                statusIconDescription={t('errorIcon', 'error icon')}
                lowContrast
                hideCloseButton
                title={t('couldNotLoadRoles', 'Could not load the roles')}
              />
            )}
            {roleChoices.roles.map((role) => (
              <Checkbox
                key={role.uuid}
                id={`user-role-${role.uuid}`}
                labelText={roleLabel(role.display)}
                checked={form.roles.includes(role.uuid)}
                onChange={(_, { checked }) => toggle('roles', role.uuid, checked)}
              />
            ))}
            {otherRoles.map((role) => (
              <Checkbox
                key={role.uuid}
                id={`user-role-${role.uuid}`}
                labelText={roleLabel(role.display)}
                checked
                disabled
              />
            ))}
            {shown('roles') && <p className={styles.invalid}>{shown('roles')}</p>}
          </fieldset>
          <fieldset className={styles.choices}>
            <legend className={styles.legend}>{t('clinics', 'Clinics')}</legend>
            {clinicChoices.map((clinic) => (
              <Checkbox
                key={clinic.uuid}
                id={`user-clinic-${clinic.uuid}`}
                labelText={clinic.display}
                checked={form.clinics.includes(clinic.uuid)}
                onChange={(_, { checked }) => toggle('clinics', clinic.uuid, checked)}
              />
            ))}
            {otherClinics.length > 0 && (
              <p className={styles.helper}>
                {t('otherClinicsKept', 'Also at {{count}} clinics not shown here, which are kept', {
                  count: otherClinics.length,
                })}
              </p>
            )}
            {shown('clinics') && <p className={styles.invalid}>{shown('clinics')}</p>}
          </fieldset>
        </div>
        <ButtonSet>
          <Button className={formStyles.button} kind="secondary" onClick={() => closeWorkspace()}>
            {t('cancel', 'Cancel')}
          </Button>
          <Button className={formStyles.button} kind="primary" disabled={saving} onClick={submit}>
            {saving ? t('saving', 'Saving...') : t('save', 'Save')}
          </Button>
        </ButtonSet>
      </Form>
    </Workspace2>
  );
}

/** Adds a user, or edits the one given: their name, roles and clinics. */
const UserFormWorkspace: React.FC<Workspace2DefinitionProps<UserFormWorkspaceProps>> = ({
  workspaceProps,
  closeWorkspace,
}) => {
  const { t } = useTranslation();
  const userUuid = workspaceProps?.userUuid;
  const { users, error, isLoading, mutate } = useUsers();
  const user = users.find((candidate) => candidate.uuid === userUuid);
  const disabled = Boolean(user?.retired);

  // Disabling the user being edited closes the form, as the modal kept the two apart.
  useEffect(() => {
    if (disabled) {
      closeWorkspace({ discardUnsavedChanges: true });
    }
  }, [disabled, closeWorkspace]);

  if (userUuid && !user) {
    return (
      <RecordLoading
        title={t('editUser', 'Edit user')}
        settled={Boolean(error) || !isLoading}
        notFound={t('couldNotLoadUser', 'Could not load this user')}
      />
    );
  }
  return <UserFormBody user={user} mutate={mutate} closeWorkspace={closeWorkspace} />;
};

export default UserFormWorkspace;
