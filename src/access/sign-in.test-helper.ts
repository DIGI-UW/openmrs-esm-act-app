import React from 'react';
import { vi } from 'vitest';
import {
  getDefaultsFromConfigSchema,
  openmrsFetch,
  useConfig,
  UserHasAccess,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import { type Config, configSchema } from '../config-schema';

/** ACT home's privilege, for tests that sign in to the home page beside another. */
export const homePrivilege = 'App: act.home';

/** Mirrors @openmrs/esm-api's userHasAccess so the mock behaves like the real framework check. */
function realUserHasAccess(requiredPrivilege: string | Array<string> | undefined, user: unknown): boolean {
  if (user === undefined) return !requiredPrivilege;
  if (!requiredPrivilege) return true;
  const session = user as { privileges?: Array<{ display: string }>; roles?: Array<{ display: string }> };
  const held = session.privileges?.map((p) => p.display) ?? [];
  const required = typeof requiredPrivilege === 'string' ? [requiredPrivilege] : requiredPrivilege;
  if (required.every((p) => held.includes(p))) return true;
  return Boolean(session.roles?.some((role) => role.display === 'System Developer'));
}

/**
 * Signs in a user holding the given privileges, checked with the framework's own userHasAccess. The
 * framework's UserHasAccess mock renders its children for everyone, so it is given the same check.
 */
export async function signInWith(privileges: Array<string>, config: Partial<Config> = {}) {
  const user = { uuid: 'user', privileges: privileges.map((display) => ({ uuid: display, display })), roles: [] };
  vi.mocked(userHasAccess).mockImplementation(realUserHasAccess as typeof userHasAccess);
  vi.mocked(UserHasAccess).mockImplementation(({ privilege, fallback, children }) =>
    realUserHasAccess(privilege, user as never)
      ? React.createElement(React.Fragment, null, children)
      : React.createElement(React.Fragment, null, fallback ?? null),
  );
  vi.mocked(useConfig<Config>).mockReturnValue({ ...(getDefaultsFromConfigSchema(configSchema) as Config), ...config });
  vi.mocked(useSession).mockReturnValue({ authenticated: true, sessionId: 'session', user } as never);
}

/**
 * Puts the signed-in user's session at a location with these tags, which make it a cardiac clinic, a primary care
 * clinic, or neither; its uuid is its name unless given. Other requests go to the fetch mock already set.
 */
export function atSessionLocation(display: string, tags: Array<string>, uuid = display) {
  const session = vi.mocked(useSession)();
  vi.mocked(useSession).mockReturnValue({ ...session, sessionLocation: { uuid, display } } as never);
  const previous = vi.mocked(openmrsFetch).getMockImplementation();
  vi.mocked(openmrsFetch).mockImplementation(((url: string, ...rest: Array<unknown>) =>
    String(url).includes(`/location/${uuid}?`)
      ? Promise.resolve({ data: { tags: tags.map((tag) => ({ display: tag })) } })
      : previous
        ? (previous as (...args: Array<unknown>) => unknown)(url, ...rest)
        : Promise.resolve({ data: {} })) as never);
}
