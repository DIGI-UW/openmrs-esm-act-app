import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Checkbox,
  DataTableSkeleton,
  InlineNotification,
  Modal,
  OverflowMenu,
  OverflowMenuItem,
  Pagination,
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
import { usePagedRows } from '../table-filters/paged-rows';
import { passwordHint } from './password-hint';
import { refusalMessage, UserForm, type UserFormValues } from './user-form.component';
import {
  addProvider,
  type ClinicUser,
  createUser,
  type NamedRole,
  type PasswordRules,
  resetPassword,
  setDisabled,
  updateUser,
  useClinics,
  useClinicUsers,
  useProviderPeople,
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
  const { providerPeople, mutate: mutateProviders } = useProviderPeople();
  const [query, setQuery] = useState('');
  const [withoutClinic, setWithoutClinic] = useState(false);
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
      .filter((user) => !withoutClinic || !user.clinics.length)
      .sort((a, b) => a.display.localeCompare(b.display));
  }, [data, query, withoutClinic]);
  const filters = useMemo(() => ({ query, withoutClinic }), [query, withoutClinic]);
  const { results, paginationProps } = usePagedRows(shown, filters);
  const hasProvider = (user: ClinicUser) => !providerPeople || providerPeople.has(user.person);

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
      const { providerError } = await createUser(values);
      await Promise.all([mutate(), mutateProviders()]);
      setEditing(null);
      if (providerError) {
        // The user exists, so saving the form again would only be refused: the row offers Add provider.
        showSnackbar({
          kind: 'warning',
          title: t('userSavedWithoutProvider', 'User saved without a provider'),
          subtitle: t(
            'addProviderToSaveForms',
            'They cannot save forms until they have one. Choose Add provider on their row. {{reason}}',
            { reason: refusalMessage(providerError) },
          ),
        });
        return;
      }
    } else {
      await updateUser(editing.uuid, values.roles, values.clinics);
      await mutate();
      setEditing(null);
    }
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
        {!data.clinicLimited &&
          data.users.some((user) => !user.clinics.length) &&
          ` ${t('usersWithoutClinic', 'Users without a clinic: {{count}}. No site administrator sees them.', {
            count: data.users.filter((user) => !user.clinics.length).length,
          })}`}
      </p>
      <div className={styles.toolbar}>
        <Search
          size="lg"
          labelText={t('searchUsers', 'Search users')}
          placeholder={t('searchUsersPlaceholder', 'Search by name or username')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {!data.clinicLimited && (
          <Checkbox
            id="users-without-clinic"
            labelText={t('onlyWithoutClinic', 'Only users without a clinic')}
            checked={withoutClinic}
            onChange={(_, { checked }) => setWithoutClinic(checked)}
          />
        )}
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
          {results.map((user) => (
            <TableRow key={user.uuid}>
              <TableCell>{user.display}</TableCell>
              <TableCell>{user.username || user.systemId}</TableCell>
              <TableCell>{user.roles.map(roleLabel).join(', ')}</TableCell>
              <TableCell>
                {user.clinics.length ? (
                  user.clinics.map(clinicName).join(', ')
                ) : (
                  <Tag type="red">{t('noClinic', 'No clinic')}</Tag>
                )}
              </TableCell>
              <TableCell>
                {user.retired ? (
                  <Tag type="gray">{t('disabled', 'Disabled')}</Tag>
                ) : (
                  <Tag type="green">{t('active', 'Active')}</Tag>
                )}
                {!hasProvider(user) && <Tag type="red">{t('noProvider', 'No provider')}</Tag>}
              </TableCell>
              <TableCell className={styles.actions}>
                {user.editable && (
                  <OverflowMenu
                    aria-label={t('userActions', 'Actions for {{name}}', { name: user.display })}
                    iconDescription={t('userActions', 'Actions for {{name}}', { name: user.display })}
                    flipped
                  >
                    <OverflowMenuItem itemText={t('edit', 'Edit')} onClick={() => setEditing(user)} />
                    {!hasProvider(user) && (
                      <OverflowMenuItem
                        itemText={t('addProvider', 'Add provider')}
                        onClick={() =>
                          run(
                            async () => {
                              await addProvider(user.person, user.username || user.systemId);
                              await mutateProviders();
                            },
                            t('providerAdded', 'Provider added'),
                          )
                        }
                      />
                    )}
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
      {shown.length > paginationProps.pageSizes[0] && <Pagination {...paginationProps} />}
      {!shown.length && <p className={styles.empty}>{t('noUsers', 'There are no users to display')}</p>}
      {editing && (
        <UserForm
          user={editing === 'new' ? undefined : editing}
          roles={roles}
          roleLabel={roleLabel}
          clinics={clinics}
          clinicName={clinicName}
          passwordRules={data.passwordRules}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
      {resetting && (
        <ResetPassword
          user={resetting}
          passwordRules={data.passwordRules}
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
  passwordRules,
  onClose,
  onReset,
}: {
  user: ClinicUser;
  passwordRules?: PasswordRules;
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
        helperText={passwordHint(t, passwordRules)}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
    </Modal>
  );
}
