import React from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { openmrsFetch, showSnackbar } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import Users from './users.component';
import { type ClinicUsers } from './users.resource';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const gulu = { uuid: 'gulu', display: 'Gulu RRH' };
const kiswa = { uuid: 'kiswa', display: 'Kiswa HC III' };
const clinician = { uuid: 'role-clinician', name: 'Organizational: ACT Clinician' };
const clerk = { uuid: 'role-clerk', name: 'Organizational: ACT Data Clerk' };
const appRole = { uuid: 'role-app', name: 'Application: ACT Registry' };

const siteAdminView: ClinicUsers = {
  clinicLimited: true,
  clinics: ['gulu'],
  assignableRoles: [clinician, clerk, appRole],
  users: [
    {
      uuid: 'u-sarah',
      username: 'sarah',
      systemId: '3-4',
      display: 'Sarah Namusoke',
      person: 'p-sarah',
      roles: [clinician],
      clinics: ['gulu', 'kiswa'],
      retired: false,
      editable: true,
    },
    {
      uuid: 'u-peter',
      username: 'peter',
      systemId: '5-6',
      display: 'Peter Okot',
      person: 'p-peter',
      roles: [clerk],
      clinics: ['gulu'],
      retired: true,
      editable: true,
    },
    {
      uuid: 'u-lydia',
      username: 'lydia',
      systemId: '7-8',
      display: 'Lydia Atwine',
      person: 'p-lydia',
      roles: [{ uuid: 'role-site-admin', name: 'Organizational: ACT Site Administrator' }],
      clinics: ['gulu'],
      retired: false,
      editable: false,
    },
  ],
};

let districtClinics: Array<{ uuid: string; display: string }> = [];

type Call = { url: string; method: string; body?: unknown };

function backend(view: ClinicUsers, refuse?: { url: RegExp; message: string }) {
  const calls: Array<Call> = [];
  mockOpenmrsFetch.mockImplementation(async (url: string, init?: { method?: string; body?: unknown }) => {
    const method = init?.method ?? 'GET';
    calls.push({ url, method, body: init?.body });
    if (refuse && method !== 'GET' && refuse.url.test(url)) {
      throw Object.assign(new Error('Forbidden'), { responseBody: { error: { message: refuse.message } } });
    }
    if (url.endsWith('/actcore/users')) {
      return { data: view } as never;
    }
    if (url.includes('/location?tag=RHD%20Tertiary')) {
      return { data: { results: [gulu] } } as never;
    }
    if (url.includes('/location?tag=RHD%20Community')) {
      return { data: { results: [kiswa] } } as never;
    }
    if (url.includes('/location?tag=RHD%20District')) {
      return { data: { results: districtClinics } } as never;
    }
    if (url.includes('/location?tag=')) {
      return { data: { results: [] } } as never;
    }
    if (url.endsWith('?v=custom:(userProperties)')) {
      return { data: { userProperties: { defaultLocation: 'gulu', 'act.clinics': 'gulu,kiswa' } } } as never;
    }
    if (method === 'POST' && url.endsWith('/user')) {
      return { data: { uuid: 'u-new', person: { uuid: 'p-new' } } } as never;
    }
    return { data: {} } as never;
  });
  return calls;
}

function renderPage() {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <Users />
    </SWRConfig>,
  );
}

describe('Users and roles', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    districtClinics = [];
    await signInWith(['Edit Users']);
  });

  it("lists a site administrator's users, with their clinics, and says whom it manages and what it can give", async () => {
    backend(siteAdminView);
    renderPage();

    expect(
      await screen.findByText('You manage the users at Gulu RRH. You can give: Clinician, Data Clerk.'),
    ).toBeInTheDocument();
    const sarah = screen.getByRole('row', { name: /Sarah Namusoke/ });
    expect(within(sarah).getByText('Gulu RRH, Kiswa HC III')).toBeInTheDocument();
    expect(within(sarah).getByText('Active')).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /Peter Okot/ })).getByText('Disabled')).toBeInTheDocument();
  });

  it('adds a user with its person, clinics and provider', async () => {
    const calls = backend(siteAdminView);
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Add user' }));

    await userEvent.type(screen.getByLabelText('Given name'), 'Ruth');
    await userEvent.type(screen.getByLabelText('Family name'), 'Apio');
    await userEvent.click(screen.getByLabelText('Female'));
    await userEvent.type(screen.getByLabelText('Username'), 'ruth');
    await userEvent.type(screen.getByLabelText('Password', { selector: 'input' }), 'Ruth12345');
    await userEvent.click(screen.getByLabelText('Clinician'));
    await userEvent.click(screen.getByLabelText('Gulu RRH'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' })));
    expect(calls.find((c) => c.method === 'POST' && c.url.endsWith('/user')).body).toEqual({
      username: 'ruth',
      password: 'Ruth12345',
      person: { names: [{ givenName: 'Ruth', familyName: 'Apio' }], gender: 'F' },
      roles: ['role-clinician'],
      userProperties: { 'act.clinics': 'gulu' },
    });
    expect(calls.find((c) => c.url.endsWith('/provider')).body).toEqual({ person: 'p-new', identifier: 'ruth' });
  });

  it("offers a site administrator only its own clinics, and keeps a user's other clinic as it is", async () => {
    const calls = backend(siteAdminView);
    renderPage();
    const sarah = await screen.findByRole('row', { name: /Sarah Namusoke/ });
    await userEvent.click(within(sarah).getByRole('button', { name: 'Actions for Sarah Namusoke' }));
    await userEvent.click(await screen.findByText('Edit'));

    expect(screen.getByLabelText('Kiswa HC III')).toBeDisabled();
    expect(screen.getByLabelText('Kiswa HC III')).toBeChecked();
    await userEvent.click(screen.getByLabelText('Data Clerk'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/user/u-sarah'))).toBe(true));
    expect(calls.find((c) => c.method === 'POST' && c.url.endsWith('/user/u-sarah')).body).toEqual({
      roles: ['role-clinician', 'role-clerk'],
      userProperties: { defaultLocation: 'gulu', 'act.clinics': 'gulu,kiswa' },
    });
  });

  it("shows ACT Core's reason when it refuses a save", async () => {
    backend(siteAdminView, {
      url: /\/user$/,
      message:
        "User is logged in but doesn't have the relevant privilege [You can give only roles that do not manage users]",
    });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Add user' }));
    await userEvent.type(screen.getByLabelText('Given name'), 'Ruth');
    await userEvent.type(screen.getByLabelText('Family name'), 'Apio');
    await userEvent.click(screen.getByLabelText('Female'));
    await userEvent.type(screen.getByLabelText('Username'), 'ruth');
    await userEvent.type(screen.getByLabelText('Password', { selector: 'input' }), 'Ruth12345');
    await userEvent.click(screen.getByLabelText('Clinician'));
    await userEvent.click(screen.getByLabelText('Gulu RRH'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('You can give only roles that do not manage users')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('disables and enables a user', async () => {
    const calls = backend(siteAdminView);
    renderPage();
    const sarah = await screen.findByRole('row', { name: /Sarah Namusoke/ });
    await userEvent.click(within(sarah).getByRole('button', { name: 'Actions for Sarah Namusoke' }));
    await userEvent.click(await screen.findByText('Disable'));
    await waitFor(() =>
      expect(calls.some((c) => c.method === 'DELETE' && c.url.includes('/user/u-sarah?reason='))).toBe(true),
    );

    const peter = screen.getByRole('row', { name: /Peter Okot/ });
    await userEvent.click(within(peter).getByRole('button', { name: 'Actions for Peter Okot' }));
    await userEvent.click(await screen.findByText('Enable'));
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'POST' && c.url.endsWith('/user/u-peter'))?.body).toEqual({
        retired: false,
      }),
    );
  });

  it('offers an administrator of every clinic all clinics', async () => {
    backend({ ...siteAdminView, clinicLimited: false, clinics: null });
    renderPage();

    expect(
      await screen.findByText('You manage the users at every clinic. You can give: Clinician, Data Clerk.'),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add user' }));
    expect(screen.getByLabelText('Gulu RRH')).toBeEnabled();
    expect(screen.getByLabelText('Kiswa HC III')).toBeEnabled();
  });

  it('finds clinics by name when an administrator chooses among many', async () => {
    districtClinics = Array.from({ length: 11 }, (_, i) => ({
      uuid: `district-${i}`,
      display: `District ${i} Hospital`,
    }));
    backend({ ...siteAdminView, clinicLimited: false, clinics: null });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Add user' }));

    expect(screen.queryByLabelText('Gulu RRH')).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Find a clinic' }), 'gulu');
    await userEvent.click(screen.getByLabelText('Gulu RRH'));
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Find a clinic' }));

    expect(screen.getByLabelText('Gulu RRH')).toBeChecked();
    expect(screen.queryByLabelText('District 3 Hospital')).not.toBeInTheDocument();
  });

  it('offers no actions on a user the administrator may not change, such as itself', async () => {
    backend(siteAdminView);
    renderPage();

    const lydia = await screen.findByRole('row', { name: /Lydia Atwine/ });
    expect(within(lydia).queryByRole('button')).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('row', { name: /Sarah Namusoke/ })).getByRole('button', {
        name: 'Actions for Sarah Namusoke',
      }),
    ).toBeInTheDocument();
  });
});
