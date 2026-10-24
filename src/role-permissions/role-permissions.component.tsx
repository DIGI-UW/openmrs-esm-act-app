import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Checkbox,
  DataTableSkeleton,
  InlineNotification,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@carbon/react';
import { showSnackbar, SystemAdministrationPictogram, userHasAccess, useSession } from '@openmrs/esm-framework';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import { restErrorMessage } from '../rest-error-message';
import { CAPABILITY_PREFIX, ROLE_PREFIX, type Role, saveCapabilities, useActRoles } from './role-permissions.resource';
import styles from './role-permissions.scss';

const capabilitiesOf = (role: Role, capabilities: Array<Role>) =>
  new Set(
    role.inheritedRoles
      .map(({ uuid }) => uuid)
      .filter((uuid) => capabilities.some((capability) => capability.uuid === uuid)),
  );

/** Which capabilities each ACT role has, for the Instance Administrator to change; ACT 2.0 had no such page. */
export default function RolePermissions() {
  const { t } = useTranslation();
  const { user } = useSession();
  const { roles, capabilities, error, isLoading, mutate } = useActRoles();
  const [drafts, setDrafts] = useState<Record<string, Set<string>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const lacking = (role: Role) => role.privileges.filter(({ display }) => !userHasAccess(display, user));
  const chosenFor = (role: Role) => drafts[role.uuid] ?? capabilitiesOf(role, capabilities);
  const changed = (role: Role) => {
    const now = chosenFor(role);
    const saved = capabilitiesOf(role, capabilities);
    return now.size !== saved.size || [...now].some((uuid) => !saved.has(uuid));
  };
  const toggle = (role: Role, capability: Role, checked: boolean) => {
    const next = new Set(chosenFor(role));
    if (checked) {
      next.add(capability.uuid);
    } else {
      next.delete(capability.uuid);
    }
    setDrafts((current) => ({ ...current, [role.uuid]: next }));
  };
  const save = async (role: Role) => {
    setSaving(role.uuid);
    setSaveError(null);
    try {
      await saveCapabilities(role, chosenFor(role), capabilities);
      await mutate();
      setDrafts(({ [role.uuid]: _saved, ...rest }) => rest);
      showSnackbar({ kind: 'success', title: t('roleSaved', 'Role saved') });
    } catch (e) {
      setSaveError(restErrorMessage(e));
    } finally {
      setSaving(null);
    }
  };

  let body: React.ReactNode;
  if (error) {
    body = (
      <InlineNotification
        kind="error"
        lowContrast
        hideCloseButton
        title={t('couldNotLoadRoles', 'Could not load the roles')}
        subtitle={restErrorMessage(error)}
      />
    );
  } else if (isLoading) {
    body = (
      <DataTableSkeleton role="progressbar" zebra columnCount={6} rowCount={6} showHeader={false} showToolbar={false} />
    );
  } else {
    body = (
      <div className={styles.tableContainer}>
        <Table aria-label={t('rolePermissions', 'Role permissions')} size="sm" useZebraStyles>
          <TableHead>
            <TableRow>
              <TableHeader>{t('role', 'Role')}</TableHeader>
              {capabilities.map((capability) => (
                <TableHeader key={capability.uuid}>
                  <span className={styles.capability}>{capability.display.slice(CAPABILITY_PREFIX.length)}</span>
                  <span className={styles.description}>{capability.description}</span>
                </TableHeader>
              ))}
              <TableHeader aria-label={t('actions', 'Actions')} />
            </TableRow>
          </TableHead>
          <TableBody>
            {roles.map((role) => {
              const name = role.display.slice(ROLE_PREFIX.length);
              const missing = lacking(role);
              const chosen = chosenFor(role);
              return (
                <TableRow key={role.uuid} data-testid="act-role-row">
                  <TableCell className={styles.role}>{name}</TableCell>
                  {capabilities.map((capability) => (
                    <TableCell key={capability.uuid}>
                      <Checkbox
                        id={`${role.uuid}-${capability.uuid}`}
                        labelText={`${name}: ${capability.display.slice(CAPABILITY_PREFIX.length)}`}
                        hideLabel
                        checked={chosen.has(capability.uuid)}
                        disabled={missing.length > 0 || lacking(capability).length > 0 || saving === role.uuid}
                        onChange={(_, { checked }) => toggle(role, capability, checked)}
                      />
                    </TableCell>
                  ))}
                  <TableCell>
                    {missing.length ? (
                      <span className={styles.readOnly}>
                        {t('needsPrivilegesToChange', 'Needs {{privileges}} to change', {
                          privileges: missing.map(({ display }) => display).join(', '),
                          interpolation: { escapeValue: false },
                        })}
                      </span>
                    ) : (
                      <Button
                        kind="ghost"
                        size="sm"
                        disabled={!changed(role) || saving === role.uuid}
                        onClick={() => save(role)}
                      >
                        {saving === role.uuid ? t('saving', 'Saving...') : t('save', 'Save')}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <>
      <ActPageHeader
        title={t('rolePermissions', 'Role permissions')}
        illustration={<SystemAdministrationPictogram />}
      />
      <div className={styles.page}>
        <p className={styles.note}>
          {t(
            'rolePermissionsNote',
            "Each ACT role is built from these capabilities. A capability you do not hold cannot be given here. The roles come from the distribution's roles file, and an update to that file replaces changes made here.",
          )}
        </p>
        {saveError && (
          <InlineNotification
            kind="error"
            lowContrast
            title={t('couldNotSaveRole', 'Could not save the role')}
            subtitle={saveError}
            onClose={() => setSaveError(null)}
          />
        )}
        {body}
      </div>
    </>
  );
}
