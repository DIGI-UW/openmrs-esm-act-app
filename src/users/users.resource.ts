import { useCallback, useMemo } from 'react';
import useSWR from 'swr';
import {
  type LoggedInUser,
  openmrsFetch,
  restBaseUrl,
  useConfig,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import { CLINICS_PROPERTY, parseClinics } from '../clinic-limit';
import { type Config } from '../config-schema';
import { fetchAll } from '../fetch-all';
import { useClinics } from '../programme-report/clinics.resource';

export interface ActUser {
  uuid: string;
  username: string;
  retired: boolean;
  userProperties: Record<string, string> | null;
  person: {
    uuid: string;
    gender: string;
    preferredName: { uuid: string; givenName: string; familyName: string } | null;
  };
  roles: Array<{ uuid: string; display: string }>;
}

const PRIVILEGE_EDIT_USERS = 'Edit Users';

const userRep =
  'custom:(uuid,username,retired,userProperties,person:(uuid,gender,preferredName:(uuid,givenName,familyName)),roles:(uuid,display))';

/**
 * The users the signed-in administrator may see, disabled ones included. ACT Core holds a site administrator to
 * the users of its clinics, so the server returns only those.
 */
export function useUsers() {
  const { data, error, isLoading, mutate } = useSWR<Array<ActUser>, Error>(['act-users'], () =>
    fetchAll<ActUser>(`${restBaseUrl}/user?v=${userRep}&includeAll=true`),
  );
  return { users: data ?? [], error, isLoading, mutate };
}

/** A user's full name, given then family, from their person's preferred name. */
export const fullName = (user: ActUser) =>
  [user.person?.preferredName?.givenName, user.person?.preferredName?.familyName].filter(Boolean).join(' ');

/** The clinics on a user's account, as location uuids. */
export const clinicsOf = (user: Pick<ActUser, 'userProperties'> | LoggedInUser) =>
  parseClinics(user?.userProperties?.[CLINICS_PROPERTY]);

/** The property OpenMRS stamps with the time, in epoch milliseconds, at each successful sign-in. */
export const LAST_SIGN_IN_PROPERTY = 'lastLoginTimestamp';

/** When a user last signed in; null if never, or if the stamp is not a time after 1970. */
export function lastSignIn(user: Pick<ActUser, 'userProperties'>) {
  const raw = user.userProperties?.[LAST_SIGN_IN_PROPERTY];
  const stamp = raw ? Number(raw) : NaN;
  return stamp > 0 ? new Date(stamp) : null;
}

/** A role's name without OpenMRS's "Organizational: ACT " prefix, as the prototype names the job roles. */
export const roleLabel = (display: string) => display.replace(/^Organizational: (ACT )?/, '');

/**
 * The job roles the signed-in administrator may give, by uuid: the first of `users.roleChoices` whose
 * administrator role they hold, as ACT 2.0 offered a site administrator the clinician roles, an instance
 * administrator those and Site Administrator, and a global administrator any role. A super user gets the first
 * choice's roles; anyone else none.
 */
function useGrantableRoles() {
  const { users } = useConfig<Config>();
  const { user } = useSession();
  return useMemo(() => {
    const held = new Set((user?.roles ?? []).map((role) => role.uuid));
    const superUser = (user?.roles ?? []).some((role) => role.display === 'System Developer');
    const choice = superUser
      ? users.roleChoices[0]
      : users.roleChoices.find(({ administratorRole }) => held.has(administratorRole));
    return { roleUuids: choice?.roles ?? [], superUser };
  }, [user, users.roleChoices]);
}

/**
 * Whether the signed-in administrator may change a user, by ACT Core's rule (AdministratorRoleAssignment): it
 * holds Edit Users and may give every role the user has. A super user may change anyone.
 */
export function useMayManageUser() {
  const { roleUuids, superUser } = useGrantableRoles();
  const { user: me } = useSession();
  return useCallback(
    (user: ActUser) =>
      superUser ||
      (!!me && userHasAccess(PRIVILEGE_EDIT_USERS, me) && user.roles.every((role) => roleUuids.includes(role.uuid))),
    [me, roleUuids, superUser],
  );
}

/** The job roles the signed-in administrator may give, fetched for their names. */
export function useRoleChoices() {
  const { roleUuids } = useGrantableRoles();
  const { data, error } = useSWR<Array<{ uuid: string; display: string }>, Error>(
    roleUuids.length ? ['act-role-choices', ...roleUuids] : null,
    () =>
      Promise.all(
        roleUuids.map((uuid) =>
          openmrsFetch<{ uuid: string; display: string }>(`${restBaseUrl}/role/${uuid}?v=custom:(uuid,display)`).then(
            ({ data: role }) => role,
          ),
        ),
      ),
  );
  return { roles: data ?? [], error, isLoading: Boolean(roleUuids.length) && !data && !error };
}

/** The clinics a user may be given: those tagged as clinics, and for a site administrator only its own. */
export function useClinicChoices() {
  const { clinicLocationTags } = useConfig<Config>();
  return useClinics([...clinicLocationTags.primaryCare, ...clinicLocationTags.cardiac]);
}

export interface UserForm {
  givenName: string;
  familyName: string;
  gender: string;
  username: string;
  password?: string;
  roles: Array<string>;
  clinics: Array<string>;
}

/** The user was created, but their provider was not, so they cannot record forms until they are saved again. */
export class ProviderNotCreated extends Error {
  constructor(readonly reason: unknown) {
    super('The provider was not created');
  }
}

function createProvider(personUuid: string, username: string) {
  return openmrsFetch(`${restBaseUrl}/provider`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { person: personUuid, identifier: username },
  });
}

/**
 * Creates a user with their person and, so they can record forms, a provider; or saves an existing user's name,
 * roles and clinics, keeping their other properties, as the server holds them now, such as the default location,
 * and gives them a provider if they have none.
 */
export async function saveUser(form: UserForm, existing?: ActUser) {
  const clinics = form.clinics.join(',');
  if (!existing) {
    const { data: created } = await openmrsFetch<{ uuid: string; person: { uuid: string } }>(`${restBaseUrl}/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        username: form.username.trim(),
        password: form.password,
        person: {
          names: [{ givenName: form.givenName.trim(), familyName: form.familyName.trim() }],
          gender: form.gender,
        },
        roles: form.roles,
        userProperties: { [CLINICS_PROPERTY]: clinics },
      },
    });
    try {
      await createProvider(created.person.uuid, form.username.trim());
    } catch (e) {
      throw new ProviderNotCreated(e);
    }
    return created.uuid;
  }
  const name = existing.person.preferredName;
  if (name && (name.givenName !== form.givenName.trim() || name.familyName !== form.familyName.trim())) {
    await openmrsFetch(`${restBaseUrl}/person/${existing.person.uuid}/name/${name.uuid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { givenName: form.givenName.trim(), familyName: form.familyName.trim() },
    });
  }
  // Read fresh: the server replaces the whole map, and the list's copy may predate a sign-in.
  const { data: current } = await openmrsFetch<Pick<ActUser, 'userProperties'>>(
    `${restBaseUrl}/user/${existing.uuid}?v=custom:(userProperties)`,
  );
  await openmrsFetch(`${restBaseUrl}/user/${existing.uuid}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      roles: form.roles,
      userProperties: { ...(current.userProperties ?? {}), [CLINICS_PROPERTY]: clinics },
    },
  });
  const { data: providers } = await openmrsFetch<{ results: Array<{ uuid: string }> }>(
    `${restBaseUrl}/provider?user=${existing.uuid}&v=custom:(uuid)`,
  );
  if (!providers.results.length) {
    await createProvider(existing.person.uuid, existing.username);
  }
  return existing.uuid;
}

/** Sets a new password for another user, which needs Edit User Passwords. */
export function resetPassword(user: ActUser, newPassword: string) {
  return openmrsFetch(`${restBaseUrl}/password/${user.uuid}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { newPassword },
  });
}

/** Disables a user, as ACT 2.0 did, by retiring them: they can no longer sign in, and their records stay. */
export function disableUser(user: ActUser, reason: string) {
  return openmrsFetch(`${restBaseUrl}/user/${user.uuid}?reason=${encodeURIComponent(reason)}`, { method: 'DELETE' });
}

/** Enables a disabled user by unretiring their account so they can sign in again. */
export function enableUser(user: ActUser) {
  return openmrsFetch(`${restBaseUrl}/user/${user.uuid}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { retired: false },
  });
}
