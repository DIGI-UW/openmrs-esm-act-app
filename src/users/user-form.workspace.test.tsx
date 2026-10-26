import React from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { showSnackbar, Workspace2 } from '@openmrs/esm-framework';
import { CLINICS_PROPERTY } from '../clinic-limit';
import UserFormWorkspace from './user-form.workspace';
import { backend, CC, CL, DC, IA, SA, signInAs } from './users.test-helper';

const closeWorkspace = vi.fn();

function renderWorkspace(userUuid?: string) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <UserFormWorkspace
        workspaceProps={{ userUuid }}
        windowProps={null}
        groupProps={null}
        launchChildWorkspace={vi.fn()}
        closeWorkspace={closeWorkspace}
        workspaceName="act-user-form-workspace"
        windowName="act-users-form"
        isRootWorkspace
        showActionMenu={false}
      />
    </SWRConfig>,
  );
}

describe('User form workspace', () => {
  beforeEach(() => vi.clearAllMocks());

  it('offers a site administrator the clinician roles and its clinic', async () => {
    backend();
    await signInAs(SA);

    renderWorkspace();
    await screen.findByRole('checkbox', { name: 'Community Clinician' });
    expect(screen.getAllByRole('checkbox').map((box) => box.getAttribute('id'))).toEqual([
      `user-role-${CC}`,
      `user-role-${DC}`,
      `user-role-${CL}`,
      'user-clinic-acimi',
    ]);
  });

  it('offers an instance administrator the clinician roles and Site Administrator, and every clinic', async () => {
    backend();
    await signInAs(IA, ['Task: act.allClinics']);

    renderWorkspace();

    expect(await screen.findByRole('checkbox', { name: 'Site Administrator' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Instance Administrator' })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Akunalaber HCIII' })).toBeInTheDocument();
  });

  it('adds a user with their person, roles and clinics, then their provider', async () => {
    const writes = backend();
    await signInAs(SA);
    renderWorkspace();

    await userEvent.type(screen.getByLabelText('Given name'), 'Sarah');
    await userEvent.type(screen.getByLabelText('Family name'), 'Apio');
    await userEvent.click(screen.getByText('Female'));
    await userEvent.type(screen.getByLabelText('Username'), 'sapio');
    await userEvent.type(screen.getByLabelText('Password'), 'Welcome123');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'Welcome123');
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Data Clerk' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Acimi HCIII' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[0]).toEqual({
      url: expect.stringMatching(/\/user$/),
      method: 'POST',
      body: {
        username: 'sapio',
        password: 'Welcome123',
        person: { names: [{ givenName: 'Sarah', familyName: 'Apio' }], gender: 'F' },
        roles: [DC],
        userProperties: { [CLINICS_PROPERTY]: 'acimi' },
      },
    });
    expect(writes[1]).toEqual({
      url: expect.stringMatching(/\/provider$/),
      method: 'POST',
      body: { person: 'new-person', identifier: 'sapio' },
    });
  });

  it('asks for a role, a clinic and matching passwords before it saves', async () => {
    const writes = backend();
    await signInAs(SA);
    renderWorkspace();

    await userEvent.type(screen.getByLabelText('Password'), 'Welcome123');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'Welcome124');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Choose at least one role')).toBeInTheDocument();
    expect(screen.getByText('Choose at least one clinic')).toBeInTheDocument();
    expect(screen.getByText('The passwords do not match')).toBeInTheDocument();
    expect(writes).toEqual([]);
  });

  it("edits a user's name, roles and clinics, keeping their other properties", async () => {
    const writes = backend();
    await signInAs(IA, ['Task: act.allClinics']);
    renderWorkspace('grace');
    await screen.findByLabelText('Family name');
    await userEvent.clear(screen.getByLabelText('Family name'));
    await userEvent.type(screen.getByLabelText('Family name'), 'Akello');
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Clinician' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Akunalaber HCIII' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[0]).toEqual({
      url: expect.stringMatching(/\/person\/grace-person\/name\/grace-name$/),
      method: 'POST',
      body: { givenName: 'Grace', familyName: 'Akello' },
    });
    expect(writes[1]).toEqual({
      url: expect.stringMatching(/\/user\/grace$/),
      method: 'POST',
      body: {
        roles: [CC, CL],
        userProperties: { [CLINICS_PROPERTY]: 'acimi,akuna', defaultLocation: 'acimi' },
      },
    });
  });

  it("shows the server's reason when it refuses a change", async () => {
    backend('This user is not at one of your clinics, so you cannot change them');
    await signInAs(SA);
    renderWorkspace('james');
    await screen.findByLabelText('Family name');
    await screen.findByRole('checkbox', { name: 'Clinician' });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('This user is not at one of your clinics, so you cannot change them'),
    ).toBeInTheDocument();
  });

  it('shows and hides a password when adding a user', async () => {
    backend();
    await signInAs(SA);
    renderWorkspace();

    expect(screen.getAllByRole('button', { name: 'Show password' })).toHaveLength(2);
    await userEvent.click(screen.getAllByRole('button', { name: 'Show password' })[0]);
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument();
  });

  it('closes the workspace, and reloads the users, once the user is saved', async () => {
    const writes = backend();
    await signInAs(IA, ['Task: act.allClinics']);
    renderWorkspace('grace');
    await screen.findByLabelText('Family name');

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(closeWorkspace).toHaveBeenCalledWith({ discardUnsavedChanges: true }));
    expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ title: 'User saved' }));
    expect(writes.length).toBeGreaterThan(0);
  });

  it('keeps the workspace open when the save fails', async () => {
    backend('Down');
    await signInAs(SA);
    renderWorkspace('james');
    await screen.findByRole('checkbox', { name: 'Clinician' });

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Down')).toBeInTheDocument();
    expect(closeWorkspace).not.toHaveBeenCalled();
  });

  it('asks the framework to guard unsaved changes only once a field is edited, and cancels on Cancel', async () => {
    backend();
    await signInAs(SA);
    renderWorkspace('james');
    await screen.findByLabelText('Family name');
    const guard = () => vi.mocked(Workspace2).mock.lastCall[0].hasUnsavedChanges;
    expect(guard()).toBe(false);

    await userEvent.type(screen.getByLabelText('Family name'), 'x');
    expect(guard()).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(closeWorkspace).toHaveBeenCalledWith();
  });
});
