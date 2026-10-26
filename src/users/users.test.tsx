import React from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getCoreTranslation, launchWorkspace2 } from '@openmrs/esm-framework';
import { restoresOpenWorkspace } from '../workspace-props.test-helper';
import Users from './users.component';
import { backend, IA, SA, signInAs } from './users.test-helper';

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

  it('lists the enabled users with their roles, clinics and status, and the disabled ones on request', async () => {
    backend();
    await signInAs(IA, ['Task: act.allClinics']);

    renderPage();

    const rows = await screen.findAllByTestId('act-user-row');
    expect(rows.map((row) => row.textContent)).toEqual([
      'Grace OkotgraceCommunity ClinicianAcimi HCIIIEnabledEdit userReset passwordDisable user',
      'James OkotjamesClinicianAcimi HCIII, Akunalaber HCIIIEnabledEdit userReset passwordDisable user',
    ]);
    await userEvent.click(screen.getByRole('switch', { name: 'Show disabled users' }));
    expect(await rowOf('Ruth Okot')).toHaveTextContent('Disabled');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search users' }), 'clinician');
    expect(screen.getAllByTestId('act-user-row')).toHaveLength(2);
  });

  it("shows its switch state and notice icon, and the disable dialog's close button from the core translations", async () => {
    backend();
    await signInAs(SA);
    renderPage();

    expect(await screen.findByText('Off')).toBeInTheDocument();
    expect(screen.getByTitle('info icon')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('switch', { name: 'Show disabled users' }));
    expect(screen.getByText('On')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear search input' })).toBeInTheDocument();

    await userEvent.click(within(await rowOf('Grace Okot')).getByRole('button', { name: 'Disable user' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(getCoreTranslation).toHaveBeenCalledWith('close');
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

  it('disables a user', async () => {
    const writes = backend();
    await signInAs(SA);
    renderPage();

    await userEvent.click(within(await rowOf('Grace Okot')).getByRole('button', { name: 'Disable user' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /Disable$/ }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual({
      url: expect.stringMatching(/\/user\/grace\?reason=/),
      method: 'DELETE',
      body: undefined,
    });
  });
});
