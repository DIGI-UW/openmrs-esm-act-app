import React from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { showSnackbar, Workspace2 } from '@openmrs/esm-framework';
import ResetPasswordWorkspace from './reset-password.workspace';
import { backend, SA, signInAs } from './users.test-helper';

const closeWorkspace = vi.fn();

async function renderWorkspace(userUuid = 'grace') {
  await signInAs(SA);
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <ResetPasswordWorkspace
        workspaceProps={{ userUuid }}
        windowProps={null}
        groupProps={null}
        launchChildWorkspace={vi.fn()}
        closeWorkspace={closeWorkspace}
        workspaceName="act-reset-password-workspace"
        windowName="act-users-form"
        isRootWorkspace
        showActionMenu={false}
      />
    </SWRConfig>,
  );
}

describe('Reset password workspace', () => {
  beforeEach(() => vi.clearAllMocks());

  it('names the user whose password it resets, and shows and hides a password', async () => {
    backend();
    await renderWorkspace();
    await screen.findByLabelText('New password');

    expect(screen.getByRole('heading', { name: 'Reset the password of Grace Okot' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Show password' })).toHaveLength(2);
    await userEvent.click(screen.getAllByRole('button', { name: 'Show password' })[0]);
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument();
  });

  it('says so when the user is not among the users loaded', async () => {
    backend();
    await renderWorkspace('nobody');

    expect(await screen.findByText('Could not load this user')).toBeInTheDocument();
  });

  it('closes the form of a user who is disabled while it is open', async () => {
    backend();
    await renderWorkspace('ruth');

    await waitFor(() => expect(closeWorkspace).toHaveBeenCalledWith({ discardUnsavedChanges: true }));
  });

  it("resets a user's password and closes the workspace", async () => {
    const writes = backend();
    await renderWorkspace();
    await screen.findByLabelText('New password');

    await userEvent.type(screen.getByLabelText('New password'), 'Changed123');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'Changed123');
    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }));

    await waitFor(() =>
      expect(writes).toEqual([
        { url: expect.stringMatching(/\/password\/grace$/), method: 'POST', body: { newPassword: 'Changed123' } },
      ]),
    );
    await waitFor(() => expect(closeWorkspace).toHaveBeenCalledWith({ discardUnsavedChanges: true }));
    expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ title: 'Password reset' }));
  });

  it('asks for a password, and for the same one twice, before it saves', async () => {
    const writes = backend();
    await renderWorkspace();
    await screen.findByLabelText('New password');

    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(screen.getByText('Enter a password')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('New password'), 'Changed123');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'Changed124');
    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }));

    expect(screen.getByText('The passwords do not match')).toBeInTheDocument();
    expect(writes).toEqual([]);
    expect(closeWorkspace).not.toHaveBeenCalled();
  });

  it("shows the server's reason when it refuses, and stays open", async () => {
    backend('You may not reset this password');
    await renderWorkspace();
    await screen.findByLabelText('New password');

    await userEvent.type(screen.getByLabelText('New password'), 'Changed123');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'Changed123');
    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }));

    expect(await screen.findByText('You may not reset this password')).toBeInTheDocument();
    expect(closeWorkspace).not.toHaveBeenCalled();
  });

  it('asks the framework to guard unsaved changes only once a password is typed, and cancels on Cancel', async () => {
    backend();
    await renderWorkspace();
    await screen.findByLabelText('New password');
    const guard = () => vi.mocked(Workspace2).mock.lastCall[0].hasUnsavedChanges;
    expect(guard()).toBe(false);

    await userEvent.type(screen.getByLabelText('New password'), 'C');
    expect(guard()).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(closeWorkspace).toHaveBeenCalledWith();
  });
});
