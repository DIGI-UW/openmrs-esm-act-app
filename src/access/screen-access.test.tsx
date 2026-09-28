import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { getDefaultsFromConfigSchema, useConfig, userHasAccess, useSession } from '@openmrs/esm-framework';
import { type Config, configSchema } from '../config-schema';
import { ScreenAccess } from './screen-access.component';

const mockUseConfig = vi.mocked(useConfig<Config>);
const mockUseSession = vi.mocked(useSession);
const mockUserHasAccess = vi.mocked(userHasAccess);

function signedInWith(privileges: Array<string>, roles: Array<string> = []) {
  mockUseSession.mockReturnValue({
    authenticated: true,
    sessionId: 'session',
    user: {
      uuid: 'user',
      privileges: privileges.map((display) => ({ uuid: display, display })),
      roles: roles.map((display) => ({ uuid: display, display })),
    },
  } as never);
}

function configWith(screenPrivileges: Partial<Config['screenPrivileges']> = {}) {
  const defaults = getDefaultsFromConfigSchema(configSchema) as Config;
  mockUseConfig.mockReturnValue({
    ...defaults,
    screenPrivileges: { ...defaults.screenPrivileges, ...screenPrivileges },
  });
}

function renderRegistry() {
  render(
    <ScreenAccess screen="registry">
      <p>Registry</p>
    </ScreenAccess>,
  );
}

describe('ScreenAccess', () => {
  beforeEach(async () => {
    const { userHasAccess: realUserHasAccess } =
      await vi.importActual<typeof import('@openmrs/esm-api')>('@openmrs/esm-api');
    mockUserHasAccess.mockImplementation(realUserHasAccess);
    configWith();
  });

  it("shows the screen to a user with the screen's privilege", () => {
    signedInWith(['View Patient Flags']);

    renderRegistry();

    expect(screen.getByText('Registry')).toBeInTheDocument();
  });

  it('hides the screen from a user without it', () => {
    signedInWith(['Get Patients']);

    renderRegistry();

    expect(screen.queryByText('Registry')).not.toBeInTheDocument();
  });

  it('uses the privilege configured for the screen', () => {
    configWith({ registry: 'App: rhd.registry' });
    signedInWith(['View Patient Flags']);

    renderRegistry();

    expect(screen.queryByText('Registry')).not.toBeInTheDocument();
  });

  it('hides the screen when nobody is signed in, even with no privilege configured', () => {
    configWith({ registry: '' });
    mockUseSession.mockReturnValue({ authenticated: false, sessionId: '' } as never);

    renderRegistry();

    expect(screen.queryByText('Registry')).not.toBeInTheDocument();
  });
});
