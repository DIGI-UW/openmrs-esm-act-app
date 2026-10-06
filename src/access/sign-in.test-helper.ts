import React from 'react';
import { vi } from 'vitest';
import {
  getDefaultsFromConfigSchema,
  useConfig,
  UserHasAccess,
  userHasAccess,
  useSession,
} from '@openmrs/esm-framework';
import { type Config, configSchema } from '../config-schema';
import type * as EsmApi from '@openmrs/esm-api';

/** ACT home's privilege, for tests that sign in to the home page beside another. */
export const homePrivilege = 'App: act.home';

/**
 * Signs in a user holding the given privileges, checked with the framework's own userHasAccess. The
 * framework's UserHasAccess mock renders its children for everyone, so it is given the same check.
 */
export async function signInWith(privileges: Array<string>, config: Partial<Config> = {}) {
  const { userHasAccess: realUserHasAccess } = await vi.importActual<typeof EsmApi>('@openmrs/esm-api');
  const user = { uuid: 'user', privileges: privileges.map((display) => ({ uuid: display, display })), roles: [] };
  vi.mocked(userHasAccess).mockImplementation(realUserHasAccess);
  vi.mocked(UserHasAccess).mockImplementation(({ privilege, fallback, children }) =>
    realUserHasAccess(privilege, user as never)
      ? React.createElement(React.Fragment, null, children)
      : React.createElement(React.Fragment, null, fallback ?? null),
  );
  vi.mocked(useConfig<Config>).mockReturnValue({ ...(getDefaultsFromConfigSchema(configSchema) as Config), ...config });
  vi.mocked(useSession).mockReturnValue({ authenticated: true, sessionId: 'session', user } as never);
}
