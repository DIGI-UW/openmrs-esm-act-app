import React from 'react';
import { SWRConfig } from 'swr';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { openmrsFetch } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import RolePermissions from './role-permissions.component';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const capability = (uuid: string, name: string, description: string, privileges: Array<string>) => ({
  uuid,
  display: `Application: ACT ${name}`,
  description,
  privileges: privileges.map((display) => ({ display })),
  inheritedRoles: [],
});
const role = (
  uuid: string,
  name: string,
  inherits: Array<{ uuid: string; display: string }>,
  privileges: Array<string> = [],
) => ({
  uuid,
  display: `Organizational: ACT ${name}`,
  description: `${name} description`,
  privileges: privileges.map((display) => ({ display })),
  inheritedRoles: inherits.map(({ uuid, display }) => ({ uuid, display })),
});

const registry = capability('cap-registry', 'Registry', 'ACT home, the registry and worklists', ['App: act.registry']);
const exportsCap = capability('cap-exports', 'Exports', 'Download ACT lists as CSV', ['Task: act.lists.export']);
const research = capability('cap-research', 'Study Management', 'Create and rename research studies', [
  'Task: act.manageStudies',
]);
const clinician = role('role-clinician', 'Clinician', [registry, exportsCap]);
const siteAdmin = role('role-site', 'Site Administrator', [clinician, registry], ['Delete Patients']);
const dataClerk = role('role-clerk', 'Data Clerk', [registry]);
const roles = [
  clinician,
  siteAdmin,
  dataClerk,
  registry,
  exportsCap,
  research,
  { uuid: 'role-other', display: 'Provider', description: '', privileges: [], inheritedRoles: [] },
];

type Call = { url: string; method: string; body: unknown };

function backend(fails?: string) {
  const writes: Array<Call> = [];
  mockOpenmrsFetch.mockImplementation((async (url: string, init?: { method?: string; body?: unknown }) => {
    const method = init?.method ?? 'GET';
    if (method !== 'GET') {
      writes.push({ url, method, body: init?.body });
      if (fails) {
        throw Object.assign(new Error('400'), { responseBody: { error: { message: fails } } });
      }
      return { data: {} };
    }
    if (url.includes('/role?')) {
      const start = Number(new URLSearchParams(url.split('?')[1]).get('startIndex') ?? 0);
      return { data: { results: roles.slice(start, start + 4), totalCount: roles.length } };
    }
    return { data: {} };
  }) as never);
  return writes;
}

function renderPage() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <RolePermissions />
    </SWRConfig>,
  );
}

const box = (roleName: string, capabilityName: string) =>
  screen.getByRole('checkbox', { name: `${roleName}: ${capabilityName}` });

// The Instance Administrator holds the registry's and exports' privileges, not research's, and not Delete Patients.
const instanceAdmin = ['Manage Roles', 'App: act.registry', 'Task: act.lists.export'];

describe('Role permissions', () => {
  it('lists the ACT roles against the ACT capabilities, each capability with what it gives, ticked where a role has it', async () => {
    backend();
    await signInWith(instanceAdmin);

    renderPage();

    await screen.findByRole('heading', { name: 'Role permissions' });
    const header = await screen.findAllByRole('columnheader');
    expect(header.map((cell) => cell.textContent)).toEqual([
      'Role',
      'ExportsDownload ACT lists as CSV',
      'RegistryACT home, the registry and worklists',
      'Study ManagementCreate and rename research studies',
      '',
    ]);
    expect(screen.getAllByTestId('act-role-row').map((row) => within(row).getAllByRole('cell')[0].textContent)).toEqual(
      ['Clinician', 'Data Clerk', 'Site Administrator'],
    );
    expect(box('Clinician', 'Registry')).toBeChecked();
    expect(box('Clinician', 'Exports')).toBeChecked();
    expect(box('Clinician', 'Study Management')).not.toBeChecked();
    expect(box('Data Clerk', 'Exports')).not.toBeChecked();
    expect(screen.queryByText('Provider')).not.toBeInTheDocument();
    expect(screen.getByText(/replaces changes made here/)).toBeInTheDocument();
  });

  it("saves a role's capabilities, keeping a role it inherits that is not an ACT capability", async () => {
    const writes = backend();
    await signInWith([...instanceAdmin, 'Delete Patients']);
    renderPage();
    await screen.findAllByTestId('act-role-row');

    await userEvent.click(box('Site Administrator', 'Exports'));
    const row = screen.getAllByTestId('act-role-row')[2];
    await userEvent.click(within(row).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual({
      url: expect.stringMatching(/\/role\/role-site$/),
      method: 'POST',
      body: { inheritedRoles: ['role-clinician', 'cap-registry', 'cap-exports'] },
    });
  });

  it("leaves a role read only, and says why, when the user lacks one of the role's own privileges, as OpenMRS refuses that save", async () => {
    backend();
    await signInWith(instanceAdmin);
    renderPage();
    await screen.findAllByTestId('act-role-row');

    const row = screen.getAllByTestId('act-role-row')[2];
    expect(box('Site Administrator', 'Exports')).toBeDisabled();
    expect(within(row).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(within(row).getByText('Needs Delete Patients to change')).toBeInTheDocument();
    expect(box('Clinician', 'Exports')).toBeEnabled();
  });

  it('gives no role a capability the user does not hold', async () => {
    backend();
    await signInWith(instanceAdmin);
    renderPage();
    await screen.findAllByTestId('act-role-row');

    expect(box('Clinician', 'Study Management')).toBeDisabled();
    expect(box('Clinician', 'Registry')).toBeEnabled();
  });

  it("shows the server's reason when it refuses a role, and keeps the change to try again", async () => {
    backend('You must have the privileges of the role');
    await signInWith(instanceAdmin);
    renderPage();
    await screen.findAllByTestId('act-role-row');

    await userEvent.click(box('Clinician', 'Exports'));
    const row = screen.getAllByTestId('act-role-row')[0];
    await userEvent.click(within(row).getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('You must have the privileges of the role')).toBeInTheDocument();
    expect(box('Clinician', 'Exports')).not.toBeChecked();
  });
});
