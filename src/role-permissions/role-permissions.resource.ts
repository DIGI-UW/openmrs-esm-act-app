import { useMemo } from 'react';
import useSWR from 'swr';
import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { fetchAll } from '../fetch-all';

export interface Role {
  uuid: string;
  display: string;
  description: string | null;
  /** The role's own privileges; OpenMRS saves a role only for a user who holds every one. */
  privileges: Array<{ display: string }>;
  inheritedRoles: Array<{ uuid: string; display: string }>;
}

/** The roles a user is given, as the distro names them. */
export const ROLE_PREFIX = 'Organizational: ACT ';
/** The capabilities ACT roles are built from, as the distro names them. */
export const CAPABILITY_PREFIX = 'Application: ACT ';

const rolesUrl = `${restBaseUrl}/role?v=custom:(uuid,display,description,privileges:(display),inheritedRoles:(uuid,display))`;
const byName = (a: Role, b: Role) => a.display.localeCompare(b.display);

/** The ACT roles and the ACT capabilities, each by name. */
export function useActRoles() {
  const { data, error, isLoading, mutate } = useSWR<Array<Role>, Error>(rolesUrl, fetchAll);
  const roles = useMemo(
    () => (data ?? []).filter(({ display }) => display.startsWith(ROLE_PREFIX)).sort(byName),
    [data],
  );
  const capabilities = useMemo(
    () => (data ?? []).filter(({ display }) => display.startsWith(CAPABILITY_PREFIX)).sort(byName),
    [data],
  );
  return { roles, capabilities, error, isLoading, mutate };
}

/** Gives the role the capabilities chosen, keeping every role it inherits that is not an ACT capability. */
export function saveCapabilities(role: Role, chosen: Set<string>, capabilities: Array<Role>) {
  const isCapability = (uuid: string) => capabilities.some((capability) => capability.uuid === uuid);
  const kept = role.inheritedRoles.map(({ uuid }) => uuid).filter((uuid) => !isCapability(uuid) || chosen.has(uuid));
  const added = capabilities.map(({ uuid }) => uuid).filter((uuid) => chosen.has(uuid) && !kept.includes(uuid));
  return openmrsFetch(`${restBaseUrl}/role/${role.uuid}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { inheritedRoles: [...kept, ...added] },
  });
}
