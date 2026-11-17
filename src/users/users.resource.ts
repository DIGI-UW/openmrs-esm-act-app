import { useMemo } from 'react';
import useSWR from 'swr';
import { type LoggedInUser, openmrsFetch, restBaseUrl, useConfig, useSession } from '@openmrs/esm-framework';
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

/** A role's name without OpenMRS's "Organizational: ACT " prefix, as the prototype names the job roles. */
export const roleLabel = (display: string) => display.replace(/^Organizational: (ACT )?/, '');

/**
 * The job roles the signed-in administrator may give, by uuid: the first of `users.roleChoices` whose
 * administrator role they hold, as ACT 2.0 offered a site administrator the clinician roles, an instance
 * administrator those and Site Administrator, and a global administrator any role. A super user gets the first
 * choice's roles; anyone else none.
 */
export function useRoleChoices() {
  const { users } = useConfig<Config>();
  const { user } = useSession();
  const roleUuids = useMemo(() => {
    const held = new Set((user?.roles ?? []).map((role) => role.uuid));
    const superUser = (user?.roles ?? []).some((role) => role.display === 'System Developer');
    const choice = superUser
      ? users.roleChoices[0]
      : users.roleChoices.find(({ administratorRole }) => held.has(administratorRole));
    return choice?.roles ?? [];
  }, [user, users.roleChoices]);
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

/**
 * Creates a user with their person and, so they can record forms, a provider; or saves an existing user's name,
 * roles and clinics, keeping their other properties such as the default location.
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
    await openmrsFetch(`${restBaseUrl}/provider`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { person: created.person.uuid, identifier: form.username.trim() },
    });
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
  await openmrsFetch(`${restBaseUrl}/user/${existing.uuid}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      roles: form.roles,
      userProperties: { ...(existing.userProperties ?? {}), [CLINICS_PROPERTY]: clinics },
    },
  });
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
