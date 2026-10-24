import React, { useMemo, useState } from 'react';
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
import {
  type LoggedInUser,
  showSnackbar,
  SystemAdministrationPictogram,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import { ActPageHeader } from '../act-page-header/act-page-header.component';
import { restErrorMessage } from '../rest-error-message';
import { TableEmptyState } from '../table-filters/empty-state.component';
import { roleLabel } from '../users/users.resource';
import { CAPABILITY_PREFIX, type Role, saveCapabilities, useActRoles } from './role-permissions.resource';
import styles from './role-permissions.scss';

const capabilityName = (capability: Role) => capability.display.slice(CAPABILITY_PREFIX.length);

const lacking = (role: Role, user: LoggedInUser) =>
  role.privileges.filter(({ display }) => !userHasAccess(display, user));

export default function RolePermissions() {
  const { t } = useTranslation();
  const { user } = useSession();
  const { roles, capabilities, error, isLoading, mutate } = useActRoles();
  const [drafts, setDrafts] = useState<Record<string, Set<string>>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { saved, through, ungivable } = useMemo(() => {
    const isCapability = (uuid: string) => capabilities.some((capability) => capability.uuid === uuid);
    const own = new Map(
      roles.map((role) => [role.uuid, new Set(role.inheritedRoles.map(({ uuid }) => uuid).filter(isCapability))]),
    );
    const viaOthers = (role: Role, seen: Set<string>): Map<string, string> => {
      const found = new Map<string, string>();
      role.inheritedRoles
        .map(({ uuid }) => roles.find((other) => other.uuid === uuid))
        .filter((other) => other && !seen.has(other.uuid))
        .forEach((other) => {
          seen.add(other.uuid);
          [...own.get(other.uuid), ...viaOthers(other, seen).keys()].forEach((uuid) =>
            found.set(uuid, found.get(uuid) ?? roleLabel(other.display)),
          );
        });
      return found;
    };
    return {
      saved: own,
      through: new Map(roles.map((role) => [role.uuid, viaOthers(role, new Set([role.uuid]))])),
      // OpenMRS saves a role whatever it inherits; this page gives only what its user holds.
      ungivable: new Set(capabilities.filter((capability) => lacking(capability, user).length).map(({ uuid }) => uuid)),
    };
  }, [roles, capabilities, user]);

  const chosenFor = (role: Role) => drafts[role.uuid] ?? saved.get(role.uuid);
  const changed = (role: Role) => {
    const now = chosenFor(role);
    const before = saved.get(role.uuid);
    return now.size !== before.size || [...now].some((uuid) => !before.has(uuid));
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
  } else if (!roles.length) {
    body = <TableEmptyState message={t('noActRoles', 'There are no ACT roles to display')} />;
  } else {
    body = (
      <div className={styles.tableContainer}>
        <Table aria-label={t('rolePermissions', 'Role permissions')} size="sm" useZebraStyles>
          <TableHead>
            <TableRow>
              <TableHeader>{t('role', 'Role')}</TableHeader>
              {capabilities.map((capability) => (
                <TableHeader key={capability.uuid}>
                  <span className={styles.capability}>{capabilityName(capability)}</span>
                  <span className={styles.description}>{capability.description}</span>
                </TableHeader>
              ))}
              <TableHeader aria-label={t('actions', 'Actions')} />
            </TableRow>
          </TableHead>
          <TableBody>
            {roles.map((role) => {
              const name = roleLabel(role.display);
              const missing = lacking(role, user);
              const chosen = chosenFor(role);
              const inherited = through.get(role.uuid);
              return (
                <TableRow key={role.uuid} data-testid="act-role-row">
                  <TableCell className={styles.role}>{name}</TableCell>
                  {capabilities.map((capability) => {
                    // Judged by what is saved, so a change made here can be undone before saving.
                    const before = saved.get(role.uuid).has(capability.uuid);
                    const via = !before && inherited.get(capability.uuid);
                    const stillVia = before && !chosen.has(capability.uuid) && inherited.get(capability.uuid);
                    const label = via
                      ? t('capabilityThrough', '{{role}}: {{capability}}, through {{through}}', {
                          role: name,
                          capability: capabilityName(capability),
                          through: via,
                          interpolation: { escapeValue: false },
                        })
                      : stillVia
                        ? t('capabilityStillThrough', '{{role}}: {{capability}}, still had through {{through}}', {
                            role: name,
                            capability: capabilityName(capability),
                            through: stillVia,
                            interpolation: { escapeValue: false },
                          })
                        : `${name}: ${capabilityName(capability)}`;
                    return (
                      <TableCell key={capability.uuid} title={via || stillVia ? label : undefined}>
                        <Checkbox
                          id={`${role.uuid}-${capability.uuid}`}
                          labelText={label}
                          hideLabel
                          checked={chosen.has(capability.uuid) || !!via}
                          disabled={
                            missing.length > 0 ||
                            !!via ||
                            (!before && ungivable.has(capability.uuid)) ||
                            saving === role.uuid
                          }
                          onChange={(_, { checked }) => toggle(role, capability, checked)}
                        />
                      </TableCell>
                    );
                  })}
                  <TableCell>
                    {missing.length ? (
                      <span className={styles.readOnly}>
                        {t('roleReadOnly', 'Read only: you need {{privileges}}', {
                          privileges: missing.map(({ display }) => display).join(', '),
                          interpolation: { escapeValue: false },
                        })}
                      </span>
                    ) : (
                      <Button
                        kind="ghost"
                        size="sm"
                        aria-label={t('saveRoleNamed', 'Save {{name}}', {
                          name,
                          interpolation: { escapeValue: false },
                        })}
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
            "Each ACT role is built from these capabilities. You can give a role a capability whose privileges you hold, and take away any it has directly. A capability a role has through another role shows ticked and is changed on that role. Before giving a role more, check that the administrators who assign it hold those privileges too, or OpenMRS will not let them save anyone who has that role. The roles come from the distribution's roles file, and an update to that file replaces changes made here.",
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
