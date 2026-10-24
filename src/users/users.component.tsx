import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Checkbox,
  DataTableSkeleton,
  InlineNotification,
  Modal,
  Pagination,
  PasswordInput,
  RadioButton,
  RadioButtonGroup,
  Search,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
  TextInput,
  Toggle,
} from '@carbon/react';
import { Add, Catalog, Edit, Locked, Password } from '@carbon/react/icons';
import {
  isDesktop,
  RegistrationPictogram,
  showSnackbar,
  useConfig,
  useLayoutType,
  UserHasAccess,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import { useClinicLimit } from '../clinic-limit';
import { type Config } from '../config-schema';
import {
  PRIVILEGE_VIEW_AUDIT_LOGS,
  PRIVILEGE_VIEW_READ_AUDIT_LOGS,
  PRIVILEGE_VIEW_SECURITY_AUDIT_LOGS,
} from '../constants';
import { UserLogPanel } from '../logs/user-log-panel.component';
import { useClinics } from '../programme-report/clinics.resource';
import { restErrorMessage } from '../rest-error-message';
import { TableEmptyState } from '../table-filters/empty-state.component';
import { usePagedRows } from '../table-filters/paged-rows';
import {
  type ActUser,
  clinicsOf,
  disableUser,
  fullName,
  resetPassword,
  roleLabel,
  saveUser,
  type UserForm,
  useRoleChoices,
  useUsers,
} from './users.resource';
import styles from './users.scss';

const PRIVILEGE_ADD_USERS = 'Add Users';
const PRIVILEGE_EDIT_USER_PASSWORDS = 'Edit User Passwords';

/** The clinics a user may be given: those tagged as clinics, and for a site administrator only its own. */
function useClinicChoices() {
  const { clinicLocationTags } = useConfig<Config>();
  return useClinics([...clinicLocationTags.primaryCare, ...clinicLocationTags.cardiac]);
}

function UserModal({ user, onClose, onSaved }: { user?: ActUser; onClose: () => void; onSaved: () => void }) {
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
  const change = (patch: Partial<UserForm>) => setForm((current) => ({ ...current, ...patch }));
  const toggle = (key: 'roles' | 'clinics', uuid: string, checked: boolean) =>
    change({ [key]: checked ? [...form[key], uuid] : form[key].filter((one) => one !== uuid) });
  // A role the administrator may not give, which only an instance administrator could have given, stays as it is.
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
      onSaved();
      onClose();
    } catch (e) {
      setSaveError(restErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      closeButtonLabel={t('close', 'Close')}
      open
      modalHeading={user ? t('editUser', 'Edit user') : t('addUser', 'Add user')}
      primaryButtonText={saving ? t('saving', 'Saving...') : t('save', 'Save')}
      secondaryButtonText={t('cancel', 'Cancel')}
      primaryButtonDisabled={saving}
      onRequestSubmit={submit}
      onRequestClose={onClose}
      size="md"
    >
      <div className={styles.form}>
        {saveError && (
          <InlineNotification
            kind="error"
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
                onChange={(event) => setConfirm(event.target.value)}
              />
            </div>
          </>
        )}
        <fieldset className={styles.choices}>
          <legend className={styles.legend}>{t('roles', 'Roles')}</legend>
          {roleChoices.error && (
            <InlineNotification
              kind="error"
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
    </Modal>
  );
}

function PasswordModal({ user, onClose }: { user: ActUser; onClose: () => void }) {
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
      onClose();
    } catch (e) {
      setSaveError(restErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      closeButtonLabel={t('close', 'Close')}
      open
      modalHeading={t('resetPasswordFor', 'Reset the password of {{name}}', { name: fullName(user) || user.username })}
      primaryButtonText={saving ? t('saving', 'Saving...') : t('resetPassword', 'Reset password')}
      secondaryButtonText={t('cancel', 'Cancel')}
      primaryButtonDisabled={saving}
      onRequestSubmit={submit}
      onRequestClose={onClose}
      size="sm"
    >
      <div className={styles.form}>
        {saveError && (
          <InlineNotification
            kind="error"
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
    </Modal>
  );
}

function DisableModal({ user, onClose, onSaved }: { user: ActUser; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const submit = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await disableUser(user, 'Disabled from the ACT Users page');
      showSnackbar({ kind: 'success', title: t('userDisabled', 'User disabled') });
      onSaved();
      onClose();
    } catch (e) {
      setSaveError(restErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      closeButtonLabel={t('close', 'Close')}
      open
      danger
      modalHeading={t('disableUserNamed', 'Disable {{name}}?', { name: fullName(user) || user.username })}
      primaryButtonText={saving ? t('saving', 'Saving...') : t('disable', 'Disable')}
      secondaryButtonText={t('cancel', 'Cancel')}
      primaryButtonDisabled={saving}
      onRequestSubmit={submit}
      onRequestClose={onClose}
      size="sm"
    >
      {saveError && (
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title={t('couldNotDisableUser', 'Could not disable the user')}
          subtitle={saveError}
        />
      )}
      <p>
        {t(
          'disableUserBody',
          'They will no longer be able to sign in. Everything they recorded stays, and an instance administrator can enable them again.',
        )}
      </p>
    </Modal>
  );
}

/**
 * ACT's Users page, as ACT 2.0's: each administrator sees the users they may administer, with their roles,
 * clinics and status, and adds, edits, resets the password of or disables them. ACT Core holds a site
 * administrator to the users of its clinics and the clinician roles; the page offers only what the server allows.
 */
export default function Users() {
  const { t } = useTranslation();
  const desktop = isDesktop(useLayoutType());
  const { user: me } = useSession();
  const limit = useClinicLimit();
  const { users, error, isLoading, mutate } = useUsers();
  const clinicChoices = useClinicChoices();
  const [query, setQuery] = useState('');
  const [showDisabled, setShowDisabled] = useState(false);
  const [editing, setEditing] = useState<ActUser | 'new' | null>(null);
  const [resetting, setResetting] = useState<ActUser | null>(null);
  const [disabling, setDisabling] = useState<ActUser | null>(null);
  const [logOf, setLogOf] = useState<ActUser | null>(null);
  const clinicName = useMemo(
    () => new Map(clinicChoices.map((clinic) => [clinic.uuid, clinic.display])),
    [clinicChoices],
  );
  const clinicNames = (user: ActUser) =>
    clinicsOf(user)
      .map((uuid) => clinicName.get(uuid))
      .filter(Boolean)
      .join(', ');
  // The Log action reads the user's entries from the sources the signed-in administrator may read.
  const mayReadLogs =
    !!me &&
    [PRIVILEGE_VIEW_AUDIT_LOGS, PRIVILEGE_VIEW_READ_AUDIT_LOGS, PRIVILEGE_VIEW_SECURITY_AUDIT_LOGS].some((one) =>
      userHasAccess(one, me),
    );

  const shown = useMemo(() => {
    const text = query.trim().toLowerCase();
    return users
      .filter((user) => showDisabled || !user.retired)
      .filter(
        (user) =>
          !text ||
          fullName(user).toLowerCase().includes(text) ||
          user.username?.toLowerCase().includes(text) ||
          user.roles.some((role) => role.display.toLowerCase().includes(text)),
      )
      .sort((a, b) => fullName(a).localeCompare(fullName(b)));
  }, [users, query, showDisabled]);
  const filters = useMemo(() => ({ query, showDisabled }), [query, showDisabled]);
  const { results, paginationProps } = usePagedRows(shown, filters);

  let body: React.ReactNode;
  if (error) {
    body = (
      <InlineNotification
        kind="error"
        lowContrast
        hideCloseButton
        title={t('couldNotLoadUsers', 'Could not load the users')}
        subtitle={restErrorMessage(error)}
      />
    );
  } else if (isLoading) {
    body = (
      <DataTableSkeleton role="progressbar" columnCount={6} compact={desktop} showHeader={false} showToolbar={false} />
    );
  } else if (!shown.length) {
    body = <TableEmptyState message={t('noUsers', 'There are no users to display')} />;
  } else {
    body = (
      <div className={styles.tableContainer}>
        <Table aria-label={t('users', 'Users')} size={desktop ? 'sm' : 'lg'} useZebraStyles>
          <TableHead>
            <TableRow>
              <TableHeader>{t('name', 'Name')}</TableHeader>
              <TableHeader>{t('username', 'Username')}</TableHeader>
              <TableHeader>{t('roles', 'Roles')}</TableHeader>
              <TableHeader>{t('clinics', 'Clinics')}</TableHeader>
              <TableHeader>{t('status', 'Status')}</TableHeader>
              <TableHeader aria-label={t('actions', 'Actions')} />
            </TableRow>
          </TableHead>
          <TableBody>
            {results.map((user) => {
              const self = user.uuid === me?.uuid;
              return (
                <TableRow key={user.uuid} data-testid="act-user-row">
                  <TableCell>{fullName(user)}</TableCell>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>{user.roles.map((role) => roleLabel(role.display)).join(', ')}</TableCell>
                  <TableCell>{clinicNames(user)}</TableCell>
                  <TableCell>
                    <Tag size="sm" type={user.retired ? 'gray' : 'green'}>
                      {user.retired ? t('disabled', 'Disabled') : t('enabled', 'Enabled')}
                    </Tag>
                  </TableCell>
                  <TableCell className={styles.actions}>
                    {!user.retired && !self && (
                      <>
                        <Button
                          kind="ghost"
                          size="sm"
                          hasIconOnly
                          renderIcon={Edit}
                          iconDescription={t('editUser', 'Edit user')}
                          onClick={() => setEditing(user)}
                        />
                        <UserHasAccess privilege={PRIVILEGE_EDIT_USER_PASSWORDS}>
                          <Button
                            kind="ghost"
                            size="sm"
                            hasIconOnly
                            renderIcon={Password}
                            iconDescription={t('resetPassword', 'Reset password')}
                            onClick={() => setResetting(user)}
                          />
                        </UserHasAccess>
                        <Button
                          kind="ghost"
                          size="sm"
                          hasIconOnly
                          renderIcon={Locked}
                          iconDescription={t('disableUser', 'Disable user')}
                          onClick={() => setDisabling(user)}
                        />
                      </>
                    )}
                    {mayReadLogs && (
                      <Button
                        kind="ghost"
                        size="sm"
                        hasIconOnly
                        renderIcon={Catalog}
                        iconDescription={t('log', 'Log')}
                        onClick={() => setLogOf(user)}
                      />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <Pagination {...paginationProps} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <ActPageHeader title={t('usersAndRoles', 'Users and roles')} illustration={<RegistrationPictogram />} />
      <div className={styles.content}>
        {limit.status === 'ready' && (
          <InlineNotification
            kind="info"
            lowContrast
            hideCloseButton
            title={t('limitedToYourClinics', 'The users of your clinics')}
            subtitle={t(
              'limitedToYourClinicsBody',
              'You can add and change the users of the clinics on your account, with the clinician roles. An instance administrator manages the others.',
            )}
          />
        )}
        <div className={styles.toolbar}>
          <Search
            closeButtonLabelText={t('clearSearchInput', 'Clear search input')}
            size="lg"
            labelText={t('searchUsers', 'Search users')}
            placeholder={t('searchUsersPlaceholder', 'Search by name, username or role')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Toggle
            labelA={t('off', 'Off')}
            labelB={t('on', 'On')}
            id="users-show-disabled"
            size="sm"
            labelText={t('showDisabledUsers', 'Show disabled users')}
            toggled={showDisabled}
            onToggle={(toggled) => setShowDisabled(toggled)}
          />
          <UserHasAccess privilege={PRIVILEGE_ADD_USERS}>
            <Button kind="primary" size="md" renderIcon={Add} onClick={() => setEditing('new')}>
              {t('addUser', 'Add user')}
            </Button>
          </UserHasAccess>
        </div>
        {logOf ? (
          <div className={styles.withPanel}>
            {body}
            <UserLogPanel
              username={logOf.username}
              name={fullName(logOf) || logOf.username}
              subtitle={[
                logOf.username,
                logOf.roles.map((role) => roleLabel(role.display)).join(', '),
                clinicNames(logOf),
              ]
                .filter(Boolean)
                .join(' · ')}
              onClose={() => setLogOf(null)}
            />
          </div>
        ) : (
          body
        )}
      </div>
      {editing && (
        <UserModal user={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={mutate} />
      )}
      {resetting && <PasswordModal user={resetting} onClose={() => setResetting(null)} />}
      {disabling && <DisableModal user={disabling} onClose={() => setDisabling(null)} onSaved={mutate} />}
    </div>
  );
}
