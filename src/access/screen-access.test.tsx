import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userHasAccess, useSession } from '@openmrs/esm-framework';
import { ActionAccess, ScreenAccess } from './screen-access.component';

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
  });

  it("shows the screen to a user with the screen's privilege", () => {
    signedInWith(['App: act.registry']);

    renderRegistry();

    expect(screen.getByText('Registry')).toBeInTheDocument();
  });

  it('hides the screen from a user without it', () => {
    signedInWith(['Get Patients']);

    renderRegistry();

    expect(screen.queryByText('Registry')).not.toBeInTheDocument();
  });

  it("hides the registry from a user who holds only another screen's privilege", () => {
    signedInWith(['App: act.worklists']);

    renderRegistry();

    expect(screen.queryByText('Registry')).not.toBeInTheDocument();
  });

  it('shows the screen to a super user, who holds every privilege', () => {
    signedInWith([], ['System Developer']);

    renderRegistry();

    expect(screen.getByText('Registry')).toBeInTheDocument();
  });

  it('hides the screen when nobody is signed in', () => {
    mockUseSession.mockReturnValue({ authenticated: false, sessionId: '' } as never);

    renderRegistry();

    expect(screen.queryByText('Registry')).not.toBeInTheDocument();
  });
});

describe('ActionAccess', () => {
  beforeEach(async () => {
    const { userHasAccess: realUserHasAccess } =
      await vi.importActual<typeof import('@openmrs/esm-api')>('@openmrs/esm-api');
    mockUserHasAccess.mockImplementation(realUserHasAccess);
  });

  it.each([
    ['recordProphylaxis', 'Task: act.recordProphylaxis'],
    ['enterClinicalForms', 'Task: act.enterClinicalForms'],
    ['exportData', 'Task: act.exportData'],
    ['registerPatient', 'Add Patients'],
    ['findPatient', 'Get Patients'],
  ] as const)('shows %s only to a user with %s', (action, privilege) => {
    signedInWith(['App: act.home']);
    const { rerender } = render(
      <ActionAccess action={action}>
        <button>Act</button>
      </ActionAccess>,
    );
    expect(screen.queryByRole('button', { name: 'Act' })).not.toBeInTheDocument();

    signedInWith([privilege]);
    rerender(
      <ActionAccess action={action}>
        <button>Act</button>
      </ActionAccess>,
    );
    expect(screen.getByRole('button', { name: 'Act' })).toBeInTheDocument();
  });
});
