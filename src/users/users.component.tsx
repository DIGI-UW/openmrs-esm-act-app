import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  DataTableSkeleton,
  InlineNotification,
  Modal,
  OverflowMenu,
  OverflowMenuItem,
  PasswordInput,
  Search,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
} from '@carbon/react';
import { DigitalTrustPictogram, showSnackbar, useConfig } from '@openmrs/esm-framework';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import { SessionLocationAndDate } from '../act-page-header/session-location-and-date.component';
import { type Config } from '../config-schema';
import { refusalMessage, UserForm, type UserFormValues } from './user-form.component';
import {
  type ClinicUser,
  createUser,
  type NamedRole,
  resetPassword,
  setDisabled,
  updateUser,
  useClinics,
  useClinicUsers,
} from './users.resource';
import styles from './users.scss';

/**
 * Admin's Users and roles: the users this administrator manages, with their roles and clinics. A site
 * administrator sees the users at its clinics and gives the clinician roles; ACT Core decides both.
 */
export default function Users() {
  const { t } = useTranslation();
  return (
    <>
      <ActPageHeader
        title={t('usersAndRoles', 'Users and roles')}
        illustration={<DigitalTrustPictogram />}
        actions={<SessionLocationAndDate />}
      />
      <div className={styles.page}>
        <UsersTable />
      </div>
    </>
  );
}

function UsersTable() {
  const { t } = useTranslation();
  const { users: usersConfig } = useConfig<Config>();
  const { data, error, isLoading, mutate } = useClinicUsers();
  const { clinics: allClinics, isLoading: clinicsLoading } = useClinics();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<ClinicUser | 'new' | null>(null);
  const [resetting, setResetting] = useState<ClinicUser | null>(null);

  const roleLabel = (role: NamedRole) =>
    role.name.startsWith(usersConfig.rolePrefix) ? role.name.slice(usersConfig.rolePrefix.length) : role.name;
  const clinicName = (uuid: string) => allClinics.find((clinic) => clinic.uuid === uuid)?.display ?? uuid;
  const roles = (data?.assignableRoles ?? []).filter((role) => role.name.startsWith(usersConfig.rolePrefix));
  const clinics = data?.clinicLimited ? allClinics.filter((clinic) => data.clinics.includes(clinic.uuid)) : allClinics;

  const shown = useMemo(() => {
    const words = query.trim().toLowerCase();
    return (data?.users ?? [])
      .filter((user) => !words || `${user.display} ${user.username ?? ''}`.toLowerCase().includes(words))
      .sort((a, b) => a.display.localeCompare(b.display));
  }, [data, query]);

  const run = async (action: () => Promise<void>, done: string) => {
    try {
      await action();
      await mutate();
      showSnackbar({ kind: 'success', title: done });
    } catch (e) {
      showSnackbar({
        kind: 'error',
        title: t('couldNotSaveUser', 'Could not save the user'),
        subtitle: refusalMessage(e),
      });
    }
  };

  const save = async (values: UserFormValues) => {
    if (editing === 'new') {
      await createUser(values);
    } else {
      await updateUser(editing.uuid, values.roles, values.clinics);
    }
    await mutate();
    setEditing(null);
    showSnackbar({ kind: 'success', title: t('userSaved', 'User saved') });
  };

  if (error) {
    return (
      <InlineNotification
        kind="error"
        lowContrast
        hideCloseButton
        title={t('couldNotLoadUsers', 'Could not load the users')}
        subtitle={error.message}
      />
    );
  }
  if (isLoading || clinicsLoading) {
    return <DataTableSkeleton role="progressbar" columnCount={6} rowCount={5} showHeader={false} showToolbar={false} />;
  }

  const headers = [
    t('name', 'Name'),
    t('username', 'Username'),
    t('roles', 'Roles'),
    t('clinics', 'Clinics'),
    t('status', 'Status'),
  ];
  return (
    <div className={styles.table}>
      <p className={styles.scope}>
        {data.clinicLimited
          ? t('manageClinicUsers', 'You manage the users at {{clinics}}. You can give: {{roles}}.', {
              clinics: clinics.map((clinic) => clinic.display).join(', '),
              roles: roles.map(roleLabel).join(', '),
            })
          : t('manageAllUsers', 'You manage the users at every clinic. You can give: {{roles}}.', {
              roles: roles.map(roleLabel).join(', '),
            })}
      </p>
      <div className={styles.toolbar}>
        <Search
          size="lg"
          labelText={t('searchUsers', 'Search users')}
          placeholder={t('searchUsersPlaceholder', 'Search by name or username')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button kind="primary" onClick={() => setEditing('new')}>
          {t('addUser', 'Add user')}
        </Button>
      </div>
      <Table size="md" useZebraStyles aria-label={t('usersAndRoles', 'Users and roles')}>
        <TableHead>
          <TableRow>
            {headers.map((header) => (
              <TableHeader key={header}>{header}</TableHeader>
            ))}
            <TableHeader aria-label={t('actions', 'Actions')} />
          </TableRow>
        </TableHead>
        <TableBody>
          {shown.map((user) => (
            <TableRow key={user.uuid}>
              <TableCell>{user.display}</TableCell>
              <TableCell>{user.username || user.systemId}</TableCell>
              <TableCell>{user.roles.map(roleLabel).join(', ')}</TableCell>
              <TableCell>{user.clinics.map(clinicName).join(', ')}</TableCell>
              <TableCell>
                {user.retired ? (
                  <Tag type="gray">{t('disabled', 'Disabled')}</Tag>
                ) : (
                  <Tag type="green">{t('active', 'Active')}</Tag>
                )}
              </TableCell>
              <TableCell className={styles.actions}>
                {user.editable && (
                  <OverflowMenu
                    aria-label={t('userActions', 'Actions for {{name}}', { name: user.display })}
                    iconDescription={t('userActions', 'Actions for {{name}}', { name: user.display })}
                    flipped
                  >
                    <OverflowMenuItem itemText={t('edit', 'Edit')} onClick={() => setEditing(user)} />
                    <OverflowMenuItem
                      itemText={t('resetPassword', 'Reset password')}
                      onClick={() => setResetting(user)}
                    />
                    <OverflowMenuItem
                      itemText={user.retired ? t('enable', 'Enable') : t('disable', 'Disable')}
                      isDelete={!user.retired}
                      onClick={() =>
                        run(
                          () => setDisabled(user.uuid, !user.retired),
                          user.retired ? t('userEnabled', 'User enabled') : t('userDisabled', 'User disabled'),
                        )
                      }
                    />
                  </OverflowMenu>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!shown.length && <p className={styles.empty}>{t('noUsers', 'There are no users to display')}</p>}
      {editing && (
        <UserForm
          user={editing === 'new' ? undefined : editing}
          roles={roles}
          roleLabel={roleLabel}
          clinics={clinics}
          clinicName={clinicName}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
      {resetting && (
        <ResetPassword
          user={resetting}
          onClose={() => setResetting(null)}
          onReset={(password) =>
            run(
              async () => {
                await resetPassword(resetting.uuid, password);
                setResetting(null);
              },
              t('passwordReset', 'Password reset'),
            )
          }
        />
      )}
    </div>
  );
}

function ResetPassword({
  user,
  onClose,
  onReset,
}: {
  user: ClinicUser;
  onClose: () => void;
  onReset: (password: string) => void;
}) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  return (
    <Modal
      open
      modalHeading={t('resetPasswordFor', 'Reset the password for {{name}}', { name: user.display })}
      primaryButtonText={t('resetPassword', 'Reset password')}
      secondaryButtonText={t('cancel', 'Cancel')}
      primaryButtonDisabled={!password}
      onRequestSubmit={() => onReset(password)}
      onRequestClose={onClose}
      size="sm"
    >
      <PasswordInput
        id="reset-password"
        labelText={t('newPassword', 'New password')}
        helperText={t('passwordRule', 'At least 8 characters, with upper and lower case letters and a number')}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
    </Modal>
  );
}
