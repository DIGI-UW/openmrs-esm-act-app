import useSWR from 'swr';
import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';

/** ACT Core keeps a user's clinics, as location uuids, in this user property. */
export const CLINICS_PROPERTY = 'act.clinics';

export interface NamedRole {
  uuid: string;
  name: string;
}

export interface ClinicUser {
  uuid: string;
  username: string | null;
  systemId: string;
  display: string;
  person: string;
  roles: Array<NamedRole>;
  clinics: Array<string>;
  retired: boolean;
  /** Whether this administrator may change the user, as ACT Core decides: not its own account, for one. */
  editable: boolean;
}

export interface ClinicUsers {
  /** True for an administrator who manages only the users at its own clinics. */
  clinicLimited: boolean;
  /** The administrator's own clinics when it is clinic-limited; null when it manages every clinic. */
  clinics: Array<string> | null;
  /** The roles this administrator may give, as ACT Core decides them. */
  assignableRoles: Array<NamedRole>;
  users: Array<ClinicUser>;
}

export interface Clinic {
  uuid: string;
  display: string;
}

const usersUrl = `${restBaseUrl}/actcore/users`;

export function useClinicUsers() {
  const { data, error, isLoading, mutate } = useSWR<ClinicUsers, Error>(
    usersUrl,
    async () => (await openmrsFetch<ClinicUsers>(usersUrl)).data,
  );
  return { data, error, isLoading, mutate };
}

/** Every location tagged as a cardiac or primary care clinic, by name. */
export function useClinics() {
  const { clinicLocationTags } = useConfig<Config>();
  const tags = [...clinicLocationTags.cardiac, ...clinicLocationTags.primaryCare];
  const { data, error, isLoading } = useSWR<Array<Clinic>, Error>(['act-clinics', ...tags], async () => {
    const byTag = await Promise.all(
      tags.map(
        async (tag) =>
          (
            await openmrsFetch<{ results: Array<Clinic> }>(
              `${restBaseUrl}/location?tag=${encodeURIComponent(tag)}&v=custom:(uuid,display)&limit=100`,
            )
          ).data.results,
      ),
    );
    const unique = new Map(byTag.flat().map((clinic) => [clinic.uuid, clinic]));
    return [...unique.values()].sort((a, b) => a.display.localeCompare(b.display));
  });
  return { clinics: data ?? [], error, isLoading };
}

export interface NewUser {
  givenName: string;
  familyName: string;
  gender: string;
  username: string;
  password: string;
  roles: Array<string>;
  clinics: Array<string>;
}

/**
 * Creates the user with its person in one request, so a refused user leaves no person behind, then
 * the provider its forms are saved under.
 */
export async function createUser(user: NewUser) {
  const { data } = await openmrsFetch<{ uuid: string; person: { uuid: string } }>(`${restBaseUrl}/user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: {
      username: user.username,
      password: user.password,
      person: { names: [{ givenName: user.givenName, familyName: user.familyName }], gender: user.gender },
      roles: user.roles,
      userProperties: { [CLINICS_PROPERTY]: user.clinics.join(',') },
    },
  });
  await openmrsFetch(`${restBaseUrl}/provider`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { person: data.person.uuid, identifier: user.username },
  });
}

/** Saves the user's roles and clinics, keeping its other properties, such as its login location. */
export async function updateUser(uuid: string, roles: Array<string>, clinics: Array<string>) {
  const { data } = await openmrsFetch<{ userProperties: Record<string, string> | null }>(
    `${restBaseUrl}/user/${uuid}?v=custom:(userProperties)`,
  );
  await openmrsFetch(`${restBaseUrl}/user/${uuid}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { roles, userProperties: { ...(data.userProperties ?? {}), [CLINICS_PROPERTY]: clinics.join(',') } },
  });
}

/** A disabled user is retired, and OpenMRS refuses its sign-in. */
export async function setDisabled(uuid: string, disabled: boolean) {
  if (disabled) {
    await openmrsFetch(`${restBaseUrl}/user/${uuid}?reason=${encodeURIComponent('Disabled in ACT')}`, {
      method: 'DELETE',
    });
  } else {
    await openmrsFetch(`${restBaseUrl}/user/${uuid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { retired: false },
    });
  }
}

export async function resetPassword(uuid: string, newPassword: string) {
  await openmrsFetch(`${restBaseUrl}/password/${uuid}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { newPassword },
  });
}
