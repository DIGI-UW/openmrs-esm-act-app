import React from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { openmrsFetch, useSession } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { CLINICS_PROPERTY } from '../clinic-limit';
import Users from './users.component';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const DC = '61e9bb28-11df-4df1-965d-11ef928d5239';
const IA = '07a7affa-b7de-46d9-9faa-aac4ef2eccba';

const users = [
  {
    uuid: 'mary',
    username: 'dataClerk2',
    retired: false,
    userProperties: { [CLINICS_PROPERTY]: 'acimi' },
    person: { uuid: 'mary-person', gender: 'F', preferredName: { uuid: 'n', givenName: 'Mary', familyName: 'Achen' } },
    roles: [{ uuid: DC, display: 'Organizational: ACT Data Clerk' }],
  },
];

function backend() {
  mockOpenmrsFetch.mockImplementation((async (url: string) => {
    if (url.includes('/location?tag=')) {
      return { data: { results: [{ uuid: 'acimi', display: 'Acimi HCIII' }], totalCount: 1 } };
    }
    if (url.includes('/user?')) {
      return { data: { results: users, totalCount: users.length } };
    }
    if (url.includes('/securityauditlogs?')) {
      return { data: { securityAuditLogs: [], totalLogs: 0 } };
    }
    return { data: { results: [], totalCount: 0 } };
  }) as never);
}

async function signInAs(extra: Array<string>) {
  await signInWith(['Edit Users', 'Add Users', 'Task: act.allClinics', ...extra]);
  const session = vi.mocked(useSession)();
  vi.mocked(useSession).mockReturnValue({
    ...session,
    user: { ...session.user, uuid: 'me', roles: [{ uuid: IA, display: 'Organizational: ACT Instance Administrator' }] },
  } as never);
}

const renderPage = () =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <Users />
    </SWRConfig>,
  );

describe("Users: a user's log", () => {
  beforeEach(() => {
    window.openmrsBase = '/openmrs';
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    backend();
  });

  it("opens the user's log beside the table from the row's Log action, for an administrator who may read the logs", async () => {
    await signInAs(['View Audit Logs', 'View Read Audit Logs', 'View Security Audit Logs']);
    renderPage();
    const row = await screen.findByTestId('act-user-row');

    await userEvent.click(within(row).getByRole('button', { name: 'Log' }));

    const panel = screen.getByRole('complementary', { name: "Mary Achen's log" });
    expect(within(panel).getByText('dataClerk2 · Data Clerk · Acimi HCIII')).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'Everything in Logs' })).toHaveAttribute(
      'href',
      '/openmrs/spa/home/act-logs?user=dataClerk2',
    );
    await userEvent.click(within(panel).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });

  it('offers no Log action to an administrator who may read neither audit log', async () => {
    await signInAs([]);
    renderPage();
    const row = await screen.findByTestId('act-user-row');

    expect(within(row).queryByRole('button', { name: 'Log' })).not.toBeInTheDocument();
  });
});
