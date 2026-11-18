import React from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { showSnackbar } from '@openmrs/esm-framework';
import UserStatusWorkspace from './user-status.workspace';
import Users from './users.component';
import { backend, IA, signInAs } from './users.test-helper';

const closeWorkspace = vi.fn();

/** The workspace beside the Users page, sharing its cache, so a change shows in the page's list. */
async function renderWorkspace(userUuid: string, enable: boolean) {
  await signInAs(IA);
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <Users />
      <UserStatusWorkspace
        workspaceProps={{ userUuid, enable }}
        windowProps={null}
        groupProps={null}
        launchChildWorkspace={vi.fn()}
        closeWorkspace={closeWorkspace}
        workspaceName="act-user-status-workspace"
        windowName="act-user-status"
        isRootWorkspace
        showActionMenu={false}
      />
    </SWRConfig>,
  );
}

const rowOf = async (name: string) =>
  (await screen.findAllByTestId('act-user-row')).find((row) => within(row).queryByText(new RegExp(`^${name}`)));

describe('User status workspace', () => {
  beforeEach(() => vi.clearAllMocks());

  it('enables a disabled user after confirmation, refreshes the list and closes', async () => {
    const writes = backend();
    await renderWorkspace('ruth', true);

    expect(await screen.findByRole('heading', { name: 'Enable Ruth Okot?' })).toBeInTheDocument();
    expect(screen.getByText('They will be able to sign in again.')).toBeInTheDocument();
    expect(writes).toEqual([]);
    await userEvent.click(screen.getByRole('button', { name: 'Enable' }));

    await waitFor(() => expect(closeWorkspace).toHaveBeenCalledWith({ discardUnsavedChanges: true }));
    expect(writes).toEqual([{ url: expect.stringMatching(/\/user\/ruth$/), method: 'POST', body: { retired: false } }]);
    expect(showSnackbar).toHaveBeenCalledWith({ kind: 'success', title: 'User enabled' });
    expect(await rowOf('Ruth Okot')).toHaveTextContent('Enabled');
  });

  it('disables a user after confirmation, with a danger button, refreshes the list and closes', async () => {
    const writes = backend();
    await renderWorkspace('grace', false);

    expect(await screen.findByRole('heading', { name: 'Disable Grace Okot?' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'They will no longer be able to sign in. Everything they recorded stays. You can enable them again from this page.',
      ),
    ).toBeInTheDocument();
    const disable = screen.getByRole('button', { name: /Disable$/ });
    expect(disable).toHaveClass('cds--btn--danger');
    await userEvent.click(disable);

    await waitFor(() => expect(closeWorkspace).toHaveBeenCalledWith({ discardUnsavedChanges: true }));
    expect(writes).toEqual([
      {
        url: expect.stringMatching(/\/user\/grace\?reason=Disabled%20from%20the%20ACT%20Users%20page$/),
        method: 'DELETE',
        body: undefined,
      },
    ]);
    expect(showSnackbar).toHaveBeenCalledWith({ kind: 'success', title: 'User disabled' });
    await waitFor(() => expect(screen.queryByText('Grace Okot')).not.toBeInTheDocument());
  });

  it.each([
    [true, 'ruth', /Enable$/, 'Could not enable the user'],
    [false, 'grace', /Disable$/, 'Could not disable the user'],
  ])("enable %s: shows the server's reason when it refuses, and stays open", async (enable, uuid, action, title) => {
    const writes = backend('You may not change this user');
    await renderWorkspace(uuid, enable);

    await userEvent.click(await screen.findByRole('button', { name: action }));

    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(screen.getByText('You may not change this user')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: action })).toBeEnabled();
    expect(writes).toHaveLength(1);
    expect(showSnackbar).not.toHaveBeenCalled();
    expect(closeWorkspace).not.toHaveBeenCalled();
  });

  it('cancels on Cancel without a write', async () => {
    const writes = backend();
    await renderWorkspace('grace', false);

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(closeWorkspace).toHaveBeenCalledWith();
    expect(writes).toEqual([]);
  });

  it('says so when the user is not among the users loaded', async () => {
    backend();
    await renderWorkspace('nobody', true);

    expect(await screen.findByText('Could not load this user')).toBeInTheDocument();
  });
});
