import React, { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import {
  Button,
  DataTableSkeleton,
  InlineNotification,
  Modal,
  Pagination,
  Search,
  SkeletonText,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
  Tile,
  Toggle,
} from '@carbon/react';
import { Add, Catalog, Edit, Locked, Password, Unlocked } from '@carbon/react/icons';
import {
  getCoreTranslation,
  isDesktop,
  launchWorkspace2,
  RegistrationPictogram,
  showSnackbar,
  useLayoutType,
  UserHasAccess,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import { useClinicLimit } from '../clinic-limit';
import {
  PRIVILEGE_VIEW_AUDIT_LOGS,
  PRIVILEGE_VIEW_READ_AUDIT_LOGS,
  PRIVILEGE_VIEW_SECURITY_AUDIT_LOGS,
} from '../constants';
import { logTime } from '../logs/log-time';
import { UserLogPanel } from '../logs/user-log-panel.component';
import { restErrorMessage } from '../rest-error-message';
import { TableEmptyState } from '../table-filters/empty-state.component';
import { usePagedRows } from '../table-filters/paged-rows';
import {
  type ActUser,
  clinicsOf,
  disableUser,
  enableUser,
  fullName,
  lastSignIn,
  roleLabel,
  useClinicChoices,
  useUsers,
} from './users.resource';
import kpiStyles from '../instance-admin/instance-admin-kpis.scss';
import styles from './users.scss';

const PRIVILEGE_ADD_USERS = 'Add Users';
const PRIVILEGE_EDIT_USER_PASSWORDS = 'Edit User Passwords';

const RECENT_DAYS = 30;

type Activity = 'recent' | 'never';

/** 'recent' for a sign-in on or after `since`, as ACT 2.0 counted active users by day; null for an older one. */
function activityOf(user: ActUser, since: number): Activity | null {
  const at = lastSignIn(user);
  if (!at) {
    return 'never';
  }
  return at.getTime() >= since ? 'recent' : null;
}

const recentSince = () => dayjs().subtract(RECENT_DAYS, 'day').startOf('day').valueOf();

function EnableModal({ user, onClose, onSaved }: { user: ActUser; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const submit = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await enableUser(user);
      showSnackbar({ kind: 'success', title: t('userEnabled', 'User enabled') });
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
      closeButtonLabel={getCoreTranslation('close')}
      open
      modalHeading={t('enableUserNamed', 'Enable {{name}}?', { name: fullName(user) || user.username })}
      primaryButtonText={saving ? t('saving', 'Saving...') : t('enable', 'Enable')}
      secondaryButtonText={t('cancel', 'Cancel')}
      primaryButtonDisabled={saving}
      onRequestSubmit={submit}
      onRequestClose={onClose}
      size="sm"
    >
      {saveError && (
        <InlineNotification
          kind="error"
          statusIconDescription={t('errorIcon', 'error icon')}
          lowContrast
          hideCloseButton
          title={t('couldNotEnableUser', 'Could not enable the user')}
          subtitle={saveError}
        />
      )}
      <p>{t('enableUserBody', 'They will be able to sign in again.')}</p>
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
      closeButtonLabel={getCoreTranslation('close')}
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
          statusIconDescription={t('errorIcon', 'error icon')}
          lowContrast
          hideCloseButton
          title={t('couldNotDisableUser', 'Could not disable the user')}
          subtitle={saveError}
        />
      )}
      <p>
        {t(
          'disableUserBody',
          'They will no longer be able to sign in. Everything they recorded stays. You can enable them again from this page.',
        )}
      </p>
    </Modal>
  );
}

/**
 * ACT's Users page, as ACT 2.0's: each administrator sees the users they may administer, with their roles,
 * clinics and status, and adds, edits, resets the password of, disables or enables them. ACT Core holds a site
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
  const [activity, setActivity] = useState<Activity | null>(null);
  const [disabling, setDisabling] = useState<ActUser | null>(null);
  const [enabling, setEnabling] = useState<ActUser | null>(null);
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

  const counts = useMemo(() => {
    const since = recentSince();
    const enabled = users.filter((user) => !user.retired);
    const activities = enabled.map((user) => activityOf(user, since));
    return {
      enabled: enabled.length,
      recent: activities.filter((one) => one === 'recent').length,
      never: activities.filter((one) => one === 'never').length,
    };
  }, [users]);
  const figures: Array<{ label: string; value: number; filter?: Activity; action?: string }> = [
    { label: t('enabledUsers', 'Enabled users'), value: counts.enabled },
    {
      label: t('signedInLastDays', 'Signed in, last {{days}} days', { days: RECENT_DAYS }),
      value: counts.recent,
      filter: 'recent',
      action: t('showUsersSignedInLastDays', 'Show only the {{count}} users who signed in in the last {{days}} days', {
        count: counts.recent,
        days: RECENT_DAYS,
      }),
    },
    {
      label: t('neverSignedIn', 'Never signed in'),
      value: counts.never,
      filter: 'never',
      action: t('showUsersNeverSignedIn', 'Show only the {{count}} users who never signed in', { count: counts.never }),
    },
  ];

  // An activity figure counts enabled users only, so while one is pressed the table lists only those.
  const shown = useMemo(() => {
    const text = query.trim().toLowerCase();
    const since = recentSince();
    return users
      .filter((user) =>
        activity ? !user.retired && activityOf(user, since) === activity : showDisabled || !user.retired,
      )
      .filter(
        (user) =>
          !text ||
          fullName(user).toLowerCase().includes(text) ||
          user.username?.toLowerCase().includes(text) ||
          user.roles.some((role) => role.display.toLowerCase().includes(text)),
      )
      .sort((a, b) => fullName(a).localeCompare(fullName(b)));
  }, [users, query, showDisabled, activity]);
  const filters = useMemo(() => ({ query, showDisabled, activity }), [query, showDisabled, activity]);
  const { results, paginationProps } = usePagedRows(shown, filters);

  let body: React.ReactNode;
  if (error) {
    body = (
      <InlineNotification
        kind="error"
        statusIconDescription={t('errorIcon', 'error icon')}
        lowContrast
        hideCloseButton
        title={t('couldNotLoadUsers', 'Could not load the users')}
        subtitle={restErrorMessage(error)}
      />
    );
  } else if (isLoading) {
    body = (
      <DataTableSkeleton role="progressbar" columnCount={7} compact={desktop} showHeader={false} showToolbar={false} />
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
              <TableHeader>{t('lastSignedIn', 'Last signed in')}</TableHeader>
              <TableHeader>{t('status', 'Status')}</TableHeader>
              <TableHeader aria-label={t('actions', 'Actions')} />
            </TableRow>
          </TableHead>
          <TableBody>
            {results.map((user) => {
              const self = user.uuid === me?.uuid;
              const signedIn = lastSignIn(user);
              return (
                <TableRow key={user.uuid} data-testid="act-user-row">
                  <TableCell>{fullName(user)}</TableCell>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>{user.roles.map((role) => roleLabel(role.display)).join(', ')}</TableCell>
                  <TableCell>{clinicNames(user)}</TableCell>
                  <TableCell>{signedIn ? logTime(t, signedIn.toISOString()) : t('never', 'Never')}</TableCell>
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
                          onClick={() => launchWorkspace2('act-user-form-workspace', { userUuid: user.uuid })}
                        />
                        <UserHasAccess privilege={PRIVILEGE_EDIT_USER_PASSWORDS}>
                          <Button
                            kind="ghost"
                            size="sm"
                            hasIconOnly
                            renderIcon={Password}
                            iconDescription={t('resetPassword', 'Reset password')}
                            onClick={() => launchWorkspace2('act-reset-password-workspace', { userUuid: user.uuid })}
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
                    {user.retired && !self && (
                      <Button
                        kind="ghost"
                        size="sm"
                        hasIconOnly
                        renderIcon={Unlocked}
                        iconDescription={t('enableUser', 'Enable user')}
                        onClick={() => setEnabling(user)}
                      />
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
            statusIconDescription={t('infoIcon', 'info icon')}
            lowContrast
            hideCloseButton
            title={t('limitedToYourClinics', 'The users of your clinics')}
            subtitle={t(
              'limitedToYourClinicsBody',
              'You can add and change the users of the clinics on your account, with the clinician roles. An instance administrator manages the others.',
            )}
          />
        )}
        {!error && (
          <div className={styles.figures}>
            {figures.map((figure) => {
              const content = (
                <>
                  <span className={kpiStyles.label}>{figure.label}</span>
                  {isLoading ? (
                    <SkeletonText heading width="40%" />
                  ) : (
                    <span className={kpiStyles.value}>{figure.value}</span>
                  )}
                </>
              );
              return figure.filter && !isLoading ? (
                <button
                  key={figure.label}
                  type="button"
                  className={styles.figureButton}
                  aria-label={figure.action}
                  aria-pressed={activity === figure.filter}
                  data-testid="act-users-figure"
                  onClick={() => setActivity(activity === figure.filter ? null : figure.filter)}
                >
                  <Tile className={`${kpiStyles.kpi} ${activity === figure.filter ? styles.pressed : ''}`}>
                    {content}
                  </Tile>
                </button>
              ) : (
                <Tile key={figure.label} className={kpiStyles.kpi} data-testid="act-users-figure">
                  {content}
                </Tile>
              );
            })}
          </div>
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
            disabled={activity !== null}
            toggled={showDisabled && activity === null}
            onToggle={(toggled) => setShowDisabled(toggled)}
          />
          <UserHasAccess privilege={PRIVILEGE_ADD_USERS}>
            <Button
              kind="primary"
              size="md"
              renderIcon={Add}
              onClick={() => launchWorkspace2('act-user-form-workspace', { userUuid: undefined })}
            >
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
      {disabling && <DisableModal user={disabling} onClose={() => setDisabling(null)} onSaved={mutate} />}
      {enabling && <EnableModal user={enabling} onClose={() => setEnabling(null)} onSaved={mutate} />}
    </div>
  );
}
