import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { fetchForm } from '../flag-gaps/flag-gaps.resource';
import { signInWith } from './sign-in.test-helper';
import { MayEnterForm } from './may-enter-form';

vi.mock('../flag-gaps/flag-gaps.resource', () => ({ fetchForm: vi.fn() }));

const echoForm = { uuid: 'echo-form', encounterType: { editPrivilege: { display: 'Task: act.enterClinicalForms' } } };
const bpgForm = { uuid: 'bpg-form', encounterType: { editPrivilege: null } };

/** Lets the form's fetch settle, so a hidden action is hidden for its privileges and not because the form is loading. */
async function formLoaded() {
  await act(async () => {
    await vi.mocked(fetchForm).mock.results.at(-1).value;
  });
}

function renderButton(formUuid: string) {
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <MayEnterForm formUuid={formUuid}>
        <button>Record</button>
      </MayEnterForm>
    </SWRConfig>,
  );
}

describe('MayEnterForm', () => {
  beforeEach(() => {
    vi.mocked(fetchForm).mockImplementation(async (uuid) => (uuid === echoForm.uuid ? echoForm : bpgForm));
  });

  it('shows the action to a user with Add Encounters, for a form whose encounter type needs no privilege', async () => {
    await signInWith(['Add Encounters']);
    renderButton(bpgForm.uuid);

    expect(await screen.findByRole('button', { name: 'Record' })).toBeInTheDocument();
  });

  it("hides the action from a user without the form's encounter type edit privilege, which the server would refuse", async () => {
    await signInWith(['Add Encounters']);
    renderButton(echoForm.uuid);

    await formLoaded();
    expect(screen.queryByRole('button', { name: 'Record' })).not.toBeInTheDocument();
  });

  it("shows the action to a user holding the form's encounter type edit privilege", async () => {
    await signInWith(['Add Encounters', 'Task: act.enterClinicalForms']);
    renderButton(echoForm.uuid);

    expect(await screen.findByRole('button', { name: 'Record' })).toBeInTheDocument();
  });

  it('hides the action from a user without Add Encounters', async () => {
    await signInWith(['Task: act.enterClinicalForms']);
    renderButton(echoForm.uuid);

    await formLoaded();
    expect(screen.queryByRole('button', { name: 'Record' })).not.toBeInTheDocument();
  });
});
