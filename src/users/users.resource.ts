import { useMemo } from 'react';
import useSWR from 'swr';
import { openmrsFetch, restBaseUrl, useConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { fetchAll } from '../fetch-all';

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

/** Core's password settings (the security.password* global properties), which an administrator cannot read itself. */
export interface PasswordRules {
  minimumLength: number;
  requiresUpperAndLowerCase: boolean;
  requiresDigit: boolean;
  requiresNonDigit: boolean;
  cannotMatchUsername: boolean;
  /** A further pattern the password must match, when the implementation sets one. */
  customRegex: string | null;
}

export interface ClinicUsers {
  /** True for an administrator who manages only the users at its own clinics. */
  clinicLimited: boolean;
  /** The administrator's own clinics when it is clinic-limited; null when it manages every clinic. */
  clinics: Array<string> | null;
  /** The roles this administrator may give, as ACT Core decides them. */
  assignableRoles: Array<NamedRole>;
  users: Array<ClinicUser>;
  /** Absent from an ACT Core that predates it, when the page falls back to core's defaults. */
  passwordRules?: PasswordRules;
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

/** The people with a provider record: a user without one cannot save forms. */
export function useProviderPeople() {
  // An array, not a Set: SWR compares results to decide whether they changed, and sees every Set as equal.
  const { data, error, isLoading, mutate } = useSWR<Array<string>, Error>('act-provider-people', async () => {
    const providers = await fetchAll<{ person: { uuid: string } | null }>(
      `${restBaseUrl}/provider?v=custom:(person:(uuid))`,
    );
    return providers.map((provider) => provider.person?.uuid).filter(Boolean);
  });
  const providerPeople = useMemo(() => (data ? new Set(data) : undefined), [data]);
  return { providerPeople, error, isLoading, mutate };
}

/** The provider a user's forms are saved under, identified by its username. */
export async function addProvider(person: string, identifier: string) {
  await openmrsFetch(`${restBaseUrl}/provider`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { person, identifier },
  });
}

/**
 * Creates the user with its person in one request, so a refused user leaves no person behind, then
 * the provider its forms are saved under. The user is kept when only the provider fails, and the
 * answer says why, so the page can offer to add the provider again.
 */
export async function createUser(user: NewUser): Promise<{ providerError?: unknown }> {
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
  try {
    await addProvider(data.person.uuid, user.username);
    return {};
  } catch (providerError) {
    return { providerError };
  }
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
