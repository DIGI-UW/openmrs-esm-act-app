import { vi } from 'vitest';
import { getDefaultsFromConfigSchema, useConfig, userHasAccess, useSession } from '@openmrs/esm-framework';
import { type Config, configSchema } from '../config-schema';
import type * as EsmApi from '@openmrs/esm-api';

/** Gives ACT home its own privilege, so a widget gated on another screen's privilege is caught. */
export const homePrivilege = 'App: act.home';

/** Gives the data clerk workspace its own privilege, so a widget gated on another screen's privilege is caught. */
export const dataClerkPrivilege = 'App: act.dataClerk';

/** Signs in a user holding the given privileges, checked with the framework's own userHasAccess. */
export async function signInWith(privileges: Array<string>, config: Partial<Config> = {}) {
  const { userHasAccess: realUserHasAccess } = await vi.importActual<typeof EsmApi>('@openmrs/esm-api');
  const defaults = getDefaultsFromConfigSchema(configSchema) as Config;
  vi.mocked(userHasAccess).mockImplementation(realUserHasAccess);
  vi.mocked(useConfig<Config>).mockReturnValue({
    ...defaults,
    ...config,
    screenPrivileges: {
      ...defaults.screenPrivileges,
      home: homePrivilege,
      dataClerk: dataClerkPrivilege,
      ...config.screenPrivileges,
    },
  });
  vi.mocked(useSession).mockReturnValue({
    authenticated: true,
    sessionId: 'session',
    user: { uuid: 'user', privileges: privileges.map((display) => ({ uuid: display, display })), roles: [] },
  } as never);
}
