import React from 'react';
import dayjs from 'dayjs';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { formatDate, launchWorkspace2, useSession } from '@openmrs/esm-framework';
import { restoresOpenWorkspace } from '../workspace-props.test-helper';
import Users from './users.component';
import { backend, IA, SA, SD, signInAs, user, users, CC, CL, DC } from './users.test-helper';

function renderPage() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <Users />
    </SWRConfig>,
  );
}

const rowOf = async (name: string) =>
  (await screen.findAllByTestId('act-user-row')).find((row) => within(row).queryByText(new RegExp(`^${name}`)));

describe('Users', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists the enabled users with their roles, clinics, last sign-in and status, and the disabled ones on request', async () => {
    backend();
    await signInAs(IA, ['Task: act.allClinics']);

    renderPage();

    const rows = await screen.findAllByTestId('act-user-row');
    expect(rows.map((row) => row.textContent)).toEqual([
      'Grace OkotgraceCommunity ClinicianAcimi HCIIINeverEnabledEdit userReset passwordDisable user',
      'James OkotjamesClinicianAcimi HCIII, Akunalaber HCIIINeverEnabledEdit userReset passwordDisable user',
    ]);
    await userEvent.click(screen.getByRole('switch', { name: 'Show disabled users' }));
    expect(await rowOf('Ruth Okot')).toHaveTextContent('Disabled');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search users' }), 'clinician');
    expect(screen.getAllByTestId('act-user-row')).toHaveLength(2);
  });

  it('shows its switch state and notice icon', async () => {
    backend();
    await signInAs(SA);
    renderPage();

    expect(await screen.findByText('Off')).toBeInTheDocument();
    expect(screen.getByTitle('info icon')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('switch', { name: 'Show disabled users' }));
    expect(screen.getByText('On')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear search input' })).toBeInTheDocument();
  });

  it('counts the enabled users who signed in in the last 30 days and those who never have, and lists them', async () => {
    const withSignIn = (given: string, roles: Array<string>, at: dayjs.Dayjs | null, retired = false) => {
      const one = user(given.toLowerCase(), given, roles, 'acimi', retired);
      return at ? { ...one, userProperties: { ...one.userProperties, lastLoginTimestamp: String(at.valueOf()) } } : one;
    };
    const twoDaysAgo = dayjs().subtract(2, 'day').hour(9).minute(5);
    backend(undefined, {
      list: [
        withSignIn('Anna', [CL], twoDaysAgo),
        withSignIn('Bea', [CL], dayjs().subtract(30, 'day').startOf('day')),
        withSignIn('Carl', [CC], dayjs().subtract(31, 'day').endOf('day')),
        withSignIn('Dora', [DC], null),
        withSignIn('Ezra', [DC], null, true),
      ],
    });
    await signInAs(IA, ['Task: act.allClinics']);
    renderPage();

    expect(await rowOf('Dora Okot')).toHaveTextContent('Never');
    const figures = screen.getAllByTestId('act-users-figure');
    expect(figures.map((figure) => figure.textContent)).toEqual([
      'Enabled users4',
      'Signed in, last 30 days2',
      'Never signed in1',
    ]);
    expect(await rowOf('Anna Okot')).toHaveTextContent(
      `${formatDate(twoDaysAgo.toDate(), { time: false, noToday: true })}, 09:05`,
    );

    await userEvent.click(screen.getByRole('switch', { name: 'Show disabled users' }));
    await userEvent.click(screen.getByRole('button', { name: 'Show only the 1 users who never signed in' }));
    expect(screen.getByRole('switch', { name: 'Show disabled users' })).toBeDisabled();
    expect(screen.getAllByTestId('act-user-row').map((row) => row.textContent)).toEqual([
      expect.stringMatching(/^Dora Okot/),
    ]);
    await userEvent.click(
      screen.getByRole('button', { name: 'Show only the 2 users who signed in in the last 30 days' }),
    );
    expect(screen.getAllByTestId('act-user-row').map((row) => row.textContent)).toEqual([
      expect.stringMatching(/^Anna Okot/),
      expect.stringMatching(/^Bea Okot/),
    ]);
    await userEvent.click(
      screen.getByRole('button', { name: 'Show only the 2 users who signed in in the last 30 days' }),
    );
    expect(screen.getAllByTestId('act-user-row')).toHaveLength(5);
  });

  it('tells a site administrator it administers the users of its clinics', async () => {
    backend();
    await signInAs(SA);

    renderPage();

    expect(await screen.findByText('The users of your clinics')).toBeInTheDocument();
  });

  it('opens the user form to add a user', async () => {
    backend();
    await signInAs(SA);
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Add user' }));

    expect(launchWorkspace2).toHaveBeenCalledWith('act-user-form-workspace', { userUuid: undefined });
  });

  it('opens the user form to edit, and the password form to reset, the user of its row', async () => {
    backend();
    await signInAs(SA);
    renderPage();

    await userEvent.click(within(await rowOf('Grace Okot')).getByRole('button', { name: 'Edit user' }));
    expect(launchWorkspace2).toHaveBeenLastCalledWith('act-user-form-workspace', { userUuid: 'grace' });
    await userEvent.click(within(await rowOf('James Okot')).getByRole('button', { name: 'Reset password' }));
    expect(launchWorkspace2).toHaveBeenLastCalledWith('act-reset-password-workspace', { userUuid: 'james' });
  });

  it('does not bring back the open Add user form for Edit user, or the open Edit form for Add user', async () => {
    backend();
    await signInAs(SA);
    renderPage();
    const propsOfLaunch = () => vi.mocked(launchWorkspace2).mock.lastCall[1] as Record<string, unknown>;

    await userEvent.click(await screen.findByRole('button', { name: 'Add user' }));
    const add = propsOfLaunch();
    await userEvent.click(within(await rowOf('Grace Okot')).getByRole('button', { name: 'Edit user' }));
    const edit = propsOfLaunch();

    expect(restoresOpenWorkspace(add, edit)).toBe(false);
    expect(restoresOpenWorkspace(edit, add)).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Add user' }));
    expect(restoresOpenWorkspace(add, propsOfLaunch())).toBe(true);
  });

  it('opens the confirmation to disable the user of its row', async () => {
    const writes = backend();
    await signInAs(SA);
    renderPage();

    await userEvent.click(within(await rowOf('Grace Okot')).getByRole('button', { name: 'Disable user' }));

    expect(launchWorkspace2).toHaveBeenCalledWith('act-user-status-workspace', { userUuid: 'grace', enable: false });
    expect(writes).toEqual([]);
  });

  it.each([IA, SA])('offers Enable instead of Disable for a disabled user to administrator %s', async (role) => {
    backend(undefined, { list: [users[0], user('ruth', 'Ruth', [CL], 'akuna', true)] });
    await signInAs(role);
    renderPage();

    await userEvent.click(await screen.findByRole('switch', { name: 'Show disabled users' }));
    const row = within(await rowOf('Ruth Okot'));
    expect(row.getByRole('button', { name: 'Enable user' })).toBeInTheDocument();
    expect(row.queryByRole('button', { name: 'Disable user' })).not.toBeInTheDocument();
    expect(within(await rowOf('Grace Okot')).queryByRole('button', { name: 'Enable user' })).not.toBeInTheDocument();
  });

  it('opens the confirmation to enable the disabled user of its row', async () => {
    const writes = backend();
    await signInAs(SA);
    renderPage();

    await userEvent.click(await screen.findByRole('switch', { name: 'Show disabled users' }));
    await userEvent.click(within(await rowOf('Ruth Okot')).getByRole('button', { name: 'Enable user' }));

    expect(launchWorkspace2).toHaveBeenCalledWith('act-user-status-workspace', { userUuid: 'ruth', enable: true });
    expect(writes).toEqual([]);
  });

  const rowActions = ['Edit user', 'Reset password', 'Disable user', 'Enable user'];
  const actionsOf = async (name: string) => {
    const row = within(await rowOf(name));
    return rowActions.filter((action) => row.queryByRole('button', { name: action }));
  };

  async function signedInAsSeesRows(role: string) {
    backend(undefined, {
      list: [
        user('grace', 'Grace', [CC], 'acimi'),
        user('dora', 'Dora', [DC], 'acimi'),
        user('mia', 'Mia', [CL, DC], 'acimi'),
        user('paul', 'Paul', [CL], 'acimi', true),
        user('ruth', 'Ruth', [DC], 'acimi', true),
      ],
    });
    await signInAs(role);
    renderPage();
    await userEvent.click(await screen.findByRole('switch', { name: 'Show disabled users' }));
  }

  it('offers no row actions to an instance administrator on a user with a role it may not give', async () => {
    await signedInAsSeesRows(IA);

    expect(await actionsOf('Grace Okot')).toEqual(['Edit user', 'Reset password', 'Disable user']);
    expect(await actionsOf('Dora Okot')).toEqual([]);
    expect(await actionsOf('Mia Okot')).toEqual([]);
    expect(await actionsOf('Paul Okot')).toEqual(['Enable user']);
    expect(await actionsOf('Ruth Okot')).toEqual([]);
  });

  it.each([
    ['a site administrator', SA],
    ['a System Developer', SD],
  ])('offers %s the row actions on a Data Clerk', async (_, role) => {
    await signedInAsSeesRows(role);

    expect(await actionsOf('Dora Okot')).toEqual(['Edit user', 'Reset password', 'Disable user']);
    expect(await actionsOf('Ruth Okot')).toEqual(['Enable user']);
    expect(await actionsOf('Paul Okot')).toEqual(['Enable user']);
  });

  it('offers no row actions to an administrator without Edit Users', async () => {
    backend();
    await signInAs(IA);
    const session = vi.mocked(useSession)();
    vi.mocked(useSession).mockReturnValue({
      ...session,
      user: {
        ...session.user,
        privileges: session.user.privileges.filter((privilege) => privilege.display !== 'Edit Users'),
      },
    } as never);
    renderPage();

    expect(await actionsOf('Grace Okot')).toEqual([]);
  });

  it('does not offer Enable for the signed-in user', async () => {
    backend(undefined, { list: [user('me', 'Admin', [SD], 'acimi', true)] });
    await signInAs(SD);
    renderPage();

    await userEvent.click(await screen.findByRole('switch', { name: 'Show disabled users' }));
    const row = within(await rowOf('Admin Okot'));
    expect(row.getByText('Disabled')).toBeInTheDocument();
    expect(row.queryByRole('button', { name: 'Enable user' })).not.toBeInTheDocument();
    expect(row.queryByRole('button', { name: 'Disable user' })).not.toBeInTheDocument();
  });
});
