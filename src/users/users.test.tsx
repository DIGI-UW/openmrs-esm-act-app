import React from 'react';
import { SWRConfig } from 'swr';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { openmrsFetch, useSession } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { CLINICS_PROPERTY } from '../clinic-limit';
import { markTranslations } from '../i18n.test-helper';
import Users from './users.component';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const CC = 'b9ab4b76-e7b9-46a7-b4ec-5b7fdd8fa540';
const DC = '61e9bb28-11df-4df1-965d-11ef928d5239';
const CL = '60625a0c-3cea-4fe5-b6ca-615c743ad9d4';
const SA = 'a1295a20-7273-4339-b5df-2f8a3a841c77';
const IA = '07a7affa-b7de-46d9-9faa-aac4ef2eccba';
const roleNames: Record<string, string> = {
  [CC]: 'Organizational: ACT Community Clinician',
  [DC]: 'Organizational: ACT Data Clerk',
  [CL]: 'Organizational: ACT Clinician',
  [SA]: 'Organizational: ACT Site Administrator',
  [IA]: 'Organizational: ACT Instance Administrator',
};
const clinics = [
  { uuid: 'acimi', display: 'Acimi HCIII' },
  { uuid: 'akuna', display: 'Akunalaber HCIII' },
];

const user = (uuid: string, given: string, roles: Array<string>, clinicUuids: string, retired = false) => ({
  uuid,
  username: given.toLowerCase(),
  retired,
  userProperties: { [CLINICS_PROPERTY]: clinicUuids, defaultLocation: 'acimi' },
  person: {
    uuid: `${uuid}-person`,
    gender: 'F',
    preferredName: { uuid: `${uuid}-name`, givenName: given, familyName: 'Okot' },
  },
  roles: roles.map((role) => ({ uuid: role, display: roleNames[role] })),
});

const users = [
  user('grace', 'Grace', [CC], 'acimi'),
  user('james', 'James', [CL], 'acimi,akuna'),
  user('ruth', 'Ruth', [DC], 'akuna', true),
];

type Call = { url: string; method: string; body: unknown };

/** The server: users, roles and clinics; every write recorded, and `fails` the error each write answers with. */
function backend(fails?: string) {
  const writes: Array<Call> = [];
  mockOpenmrsFetch.mockImplementation((async (url: string, init?: { method?: string; body?: unknown }) => {
    const method = init?.method ?? 'GET';
    if (method !== 'GET') {
      writes.push({ url, method, body: init?.body });
      if (fails) {
        throw Object.assign(new Error('403'), { responseBody: { error: { message: fails } } });
      }
      return { data: url.endsWith('/user') ? { uuid: 'new-user', person: { uuid: 'new-person' } } : {} };
    }
    const role = /\/role\/([^?]+)/.exec(url)?.[1];
    if (role) {
      return { data: { uuid: role, display: roleNames[role] } };
    }
    if (url.includes('/location?tag=')) {
      return { data: { results: clinics, totalCount: clinics.length } };
    }
    if (/\/location\/acimi\?/.test(url)) {
      return { data: { display: 'Acimi HCIII' } };
    }
    if (url.includes('/user?')) {
      return { data: { results: users, totalCount: users.length } };
    }
    return { data: { results: [] } };
  }) as never);
  return writes;
}

/** Signs in with a role and the privileges a user administrator holds; a site administrator's account names Acimi. */
async function signInAs(role: string, extra: Array<string> = []) {
  await signInWith(['Edit Users', 'Add Users', 'Edit User Passwords', ...extra]);
  const session = vi.mocked(useSession)();
  vi.mocked(useSession).mockReturnValue({
    ...session,
    user: {
      ...session.user,
      uuid: 'me',
      roles: [{ uuid: role, display: roleNames[role] }],
      userProperties: { [CLINICS_PROPERTY]: 'acimi' },
    },
  } as never);
}

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

  it('offers the words its switch, search box, password fields and dialogs would show in English to translation', async () => {
    markTranslations();
    backend();
    await signInAs(SA);
    renderPage();

    expect(await screen.findByText('«Off»')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '«Clear search input»' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '«Add user»' }));
    let dialog = await screen.findByRole('dialog');
    expect(within(dialog).getAllByRole('button', { name: '«Show password»' })).toHaveLength(2);
    await userEvent.click(within(dialog).getByRole('button', { name: '«Close»' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await userEvent.click(within(await rowOf('Grace Okot')).getByRole('button', { name: '«Reset password»' }));
    dialog = await screen.findByRole('dialog');
    expect(within(dialog).getAllByRole('button', { name: '«Show password»' })).toHaveLength(2);
    await userEvent.click(within(dialog).getByRole('button', { name: '«Close»' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await userEvent.click(within(await rowOf('Grace Okot')).getByRole('button', { name: '«Disable user»' }));
    dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: '«Close»' })).toBeInTheDocument();
  });

  it('tells a site administrator it administers the users of its clinics, and offers it the clinician roles and its clinic', async () => {
    backend();
    await signInAs(SA);

    renderPage();

    expect(await screen.findByText('The users of your clinics')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add user' }));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByRole('checkbox', { name: 'Community Clinician' });
    expect(
      within(dialog)
        .getAllByRole('checkbox')
        .map((box) => box.getAttribute('id')),
    ).toEqual([`user-role-${CC}`, `user-role-${DC}`, `user-role-${CL}`, 'user-clinic-acimi']);
  });

  it('offers an instance administrator the clinician roles and Site Administrator, and every clinic', async () => {
    backend();
    await signInAs(IA, ['Task: act.allClinics']);

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Add user' }));

    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByRole('checkbox', { name: 'Site Administrator' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('checkbox', { name: 'Instance Administrator' })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('checkbox', { name: 'Akunalaber HCIII' })).toBeInTheDocument();
  });

  it('adds a user with their person, roles and clinics, then their provider', async () => {
    const writes = backend();
    await signInAs(SA);
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Add user' }));
    const dialog = await screen.findByRole('dialog');

    await userEvent.type(within(dialog).getByLabelText('Given name'), 'Sarah');
    await userEvent.type(within(dialog).getByLabelText('Family name'), 'Apio');
    await userEvent.click(within(dialog).getByText('Female'));
    await userEvent.type(within(dialog).getByLabelText('Username'), 'sapio');
    await userEvent.type(within(dialog).getByLabelText('Password'), 'Welcome123');
    await userEvent.type(within(dialog).getByLabelText('Confirm password'), 'Welcome123');
    await userEvent.click(await within(dialog).findByRole('checkbox', { name: 'Data Clerk' }));
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Acimi HCIII' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

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
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Add user' }));
    const dialog = await screen.findByRole('dialog');

    await userEvent.type(within(dialog).getByLabelText('Password'), 'Welcome123');
    await userEvent.type(within(dialog).getByLabelText('Confirm password'), 'Welcome124');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(within(dialog).getByText('Choose at least one role')).toBeInTheDocument();
    expect(within(dialog).getByText('Choose at least one clinic')).toBeInTheDocument();
    expect(within(dialog).getByText('The passwords do not match')).toBeInTheDocument();
    expect(writes).toEqual([]);
  });

  it("edits a user's name, roles and clinics, keeping their other properties", async () => {
    const writes = backend();
    await signInAs(IA, ['Task: act.allClinics']);
    renderPage();

    await userEvent.click(within(await rowOf('Grace Okot')).getByRole('button', { name: 'Edit user' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.clear(within(dialog).getByLabelText('Family name'));
    await userEvent.type(within(dialog).getByLabelText('Family name'), 'Akello');
    await userEvent.click(await within(dialog).findByRole('checkbox', { name: 'Clinician' }));
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Akunalaber HCIII' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

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
    renderPage();

    await userEvent.click(within(await rowOf('James Okot')).getByRole('button', { name: 'Edit user' }));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByRole('checkbox', { name: 'Clinician' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(
      await within(dialog).findByText('This user is not at one of your clinics, so you cannot change them'),
    ).toBeInTheDocument();
  });

  it("resets a user's password and disables a user", async () => {
    const writes = backend();
    await signInAs(SA);
    renderPage();

    await userEvent.click(within(await rowOf('Grace Okot')).getByRole('button', { name: 'Reset password' }));
    let dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('New password'), 'Changed123');
    await userEvent.type(within(dialog).getByLabelText('Confirm password'), 'Changed123');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reset password' }));
    await waitFor(() =>
      expect(writes).toEqual([
        { url: expect.stringMatching(/\/password\/grace$/), method: 'POST', body: { newPassword: 'Changed123' } },
      ]),
    );

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await userEvent.click(within(await rowOf('Grace Okot')).getByRole('button', { name: 'Disable user' }));
    dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /Disable$/ }));
    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[1]).toEqual({
      url: expect.stringMatching(/\/user\/grace\?reason=/),
      method: 'DELETE',
      body: undefined,
    });
  });
});
