import React from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { openmrsFetch, showSnackbar, Workspace2 } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import { signInWith } from '../access/sign-in.test-helper';
import ClinicFormWorkspace from './clinic-form.workspace';
import { backend, locations } from './clinics.test-helper';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const closeWorkspace = vi.fn();

function renderWorkspace(clinicUuid?: string) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <ClinicFormWorkspace
        workspaceProps={{ clinicUuid }}
        windowProps={null}
        groupProps={null}
        launchChildWorkspace={vi.fn()}
        closeWorkspace={closeWorkspace}
        workspaceName="act-clinic-form-workspace"
        windowName="act-clinics-form"
        isRootWorkspace
        showActionMenu={false}
      />
    </SWRConfig>,
  );
}

const locationReads = () => mockOpenmrsFetch.mock.calls.filter(([url]) => String(url).includes('/location?')).length;
const parentOptions = () =>
  within(screen.getByLabelText('Parent clinic'))
    .getAllByRole('option')
    .map((option) => option.textContent);

describe('Clinic form workspace', () => {
  beforeEach(() => vi.clearAllMocks());

  it('adds a clinic with its level and the working tags, its parent, and its type and level in the description', async () => {
    const writes = backend();
    await signInWith(['Manage Locations']);
    renderWorkspace();
    await screen.findByRole('option', { name: 'Lira Regional Referral Hospital' });

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Enter the clinic name')).toBeInTheDocument();
    expect(screen.getByText('Choose the clinic level')).toBeInTheDocument();
    expect(screen.getByText('Choose the clinic type')).toBeInTheDocument();
    expect(writes).toHaveLength(0);

    await userEvent.type(screen.getByLabelText('Name'), '  Ober HCIV ');
    await userEvent.selectOptions(screen.getByLabelText('Level'), 'Community');
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'Private For-Profit');
    await userEvent.selectOptions(screen.getByLabelText('Parent clinic'), 'lira');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toEqual({
      url: expect.stringMatching(/\/location$/),
      method: 'POST',
      body: {
        name: 'Ober HCIV',
        description: 'Private For-Profit, Community level',
        tags: ['tag-community', 'tag-visit', 'tag-queue', 'tag-login'],
        parentLocation: 'lira',
      },
    });
  });

  it('offers a parent only among the other tertiary and district clinics, as ACT 2.0 did', async () => {
    backend();
    await signInWith(['Manage Locations']);
    renderWorkspace('lira');
    await screen.findByDisplayValue('Lira Regional Referral Hospital');

    expect(parentOptions()).toEqual(['None', 'JCRC Lubowa', 'No Clinic', 'Uganda Heart Institute Tertiary']);
  });

  it("still offers a clinic's disabled parent, and no other disabled clinic", async () => {
    backend();
    await signInWith(['Manage Locations']);
    renderWorkspace('mbale');

    expect(await screen.findByLabelText('Parent clinic')).toHaveValue('old-district');
    expect(parentOptions()).toContain('Old District Hospital');
    expect(parentOptions()).not.toContain('Closed HCIII');
  });

  it("does not offer a disabled clinic that is not the edited clinic's parent", async () => {
    backend();
    await signInWith(['Manage Locations']);
    renderWorkspace('lira');
    await screen.findByDisplayValue('Lira Regional Referral Hospital');

    expect(parentOptions()).not.toContain('Old District Hospital');
  });

  it("still offers a clinic's parent that is now at a level no parent is chosen from", async () => {
    const writes = backend(
      undefined,
      locations.map((location) =>
        location.uuid === 'mbale'
          ? { ...location, parentLocation: { uuid: 'amach', display: 'Amach HCIV' } }
          : location,
      ),
    );
    await signInWith(['Manage Locations']);
    renderWorkspace('mbale');

    const parent = (await screen.findByLabelText('Parent clinic')) as HTMLSelectElement;
    expect(parent).toHaveValue('amach');
    expect(parent.selectedOptions[0]).toHaveTextContent('Amach HCIV');
    await userEvent.selectOptions(parent, '');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0].body).toMatchObject({ parentLocation: null });
  });

  it("still offers a clinic's parent that is not a clinic, so it shows and can be cleared", async () => {
    const writes = backend(
      undefined,
      locations.map((location) =>
        location.uuid === 'mbale'
          ? { ...location, parentLocation: { uuid: 'eastern', display: 'Eastern Region' } }
          : location,
      ),
    );
    await signInWith(['Manage Locations']);
    renderWorkspace('mbale');

    const parent = (await screen.findByLabelText('Parent clinic')) as HTMLSelectElement;
    expect(parent).toHaveValue('eastern');
    expect(parent.selectedOptions[0]).toHaveTextContent('Eastern Region');
    await userEvent.selectOptions(parent, '');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0].body).toMatchObject({ parentLocation: null });
  });

  it("edits a clinic's name, level and type, keeping its other tags, and disables it", async () => {
    const writes = backend();
    await signInWith(['Manage Locations']);
    renderWorkspace('lira');

    expect(await screen.findByDisplayValue('Lira Regional Referral Hospital')).toBe(screen.getByLabelText('Name'));
    expect(screen.getByLabelText('Type')).toHaveValue('Public');
    expect(screen.getByLabelText('Level')).toHaveValue('District');
    expect(screen.getByLabelText('Parent clinic')).toHaveValue('uhi');

    await userEvent.clear(screen.getByLabelText('Name'));
    await userEvent.type(screen.getByLabelText('Name'), 'Lira RRH');
    await userEvent.selectOptions(screen.getByLabelText('Level'), 'Tertiary');
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'Private Not-For-Profit');
    await userEvent.selectOptions(screen.getByLabelText('Parent clinic'), '');
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'disabled');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[0]).toEqual({
      url: expect.stringMatching(/\/location\/lira$/),
      method: 'POST',
      body: {
        name: 'Lira RRH',
        description: 'Private Not-For-Profit, Tertiary level',
        tags: ['tag-tertiary', 'tag-visit', 'tag-queue', 'tag-login'],
        parentLocation: null,
      },
    });
    expect(writes[1]).toEqual({
      url: expect.stringMatching(/\/location\/lira\?reason=/),
      method: 'DELETE',
      body: undefined,
    });
  });

  it("hands the edit title the clinic's name unescaped, as a name such as St. Joseph's carries an apostrophe", async () => {
    const t = vi.spyOn(useTranslation(), 't');
    backend();
    await signInWith(['Manage Locations']);
    renderWorkspace('amach');
    await screen.findByDisplayValue('Amach HCIV');

    expect(t).toHaveBeenCalledWith(
      'editClinicNamed',
      expect.any(String),
      expect.objectContaining({ name: 'Amach HCIV', interpolation: { escapeValue: false } }),
    );
    t.mockRestore();
  });

  it("keeps a clinic's type that is none of the three", async () => {
    const writes = backend();
    await signInWith(['Manage Locations']);
    renderWorkspace('noclinic');

    expect(await screen.findByDisplayValue('No Designation')).toBe(screen.getByLabelText('Type'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0].body).toMatchObject({ description: 'No Designation, District level', tags: ['tag-district'] });
  });

  it('enables a disabled clinic', async () => {
    const writes = backend();
    await signInWith(['Manage Locations']);
    renderWorkspace('closed');

    await userEvent.selectOptions(await screen.findByLabelText('Status'), 'enabled');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[1]).toEqual({
      url: expect.stringMatching(/\/location\/closed$/),
      method: 'POST',
      body: { retired: false },
    });
  });

  it('names a configured tag the server lacks, rather than sending a clinic OpenMRS cannot save', async () => {
    const writes = backend();
    await signInWith(['Manage Locations'], {
      clinics: {
        levels: [{ tag: 'RHD District', level: 'District' }],
        types: ['Public'],
        newClinicTags: ['Visit Location', 'Triage Location'],
      },
    });
    renderWorkspace();

    await userEvent.type(screen.getByLabelText('Name'), 'Ober HCIV');
    await userEvent.selectOptions(screen.getByLabelText('Level'), 'District');
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'Public');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('The server has no location tag named Triage Location; ask an administrator to add it'),
    ).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it('says the location tags could not load, and offers no Save, rather than saving a clinic without them', async () => {
    backend();
    const previous = mockOpenmrsFetch.getMockImplementation();
    mockOpenmrsFetch.mockImplementation(((url: string, ...rest: Array<unknown>) =>
      String(url).includes('/locationtag?')
        ? Promise.reject(new Error('Network error'))
        : (previous as (...args: Array<unknown>) => unknown)(url, ...rest)) as never);
    await signInWith(['Manage Locations']);
    renderWorkspace();

    expect(
      await screen.findByText('Could not load the location tags, so the clinic cannot be saved'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it("shows the server's reason when it refuses a clinic, and keeps the workspace open", async () => {
    backend('A location with this name already exists');
    await signInWith(['Manage Locations']);
    renderWorkspace();

    await userEvent.type(screen.getByLabelText('Name'), 'Lira Regional Referral Hospital');
    await userEvent.selectOptions(screen.getByLabelText('Level'), 'District');
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'Public');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('A location with this name already exists')).toBeInTheDocument();
    expect(closeWorkspace).not.toHaveBeenCalled();
  });

  it('reloads the clinics, and closes the workspace, once the clinic is saved', async () => {
    backend();
    await signInWith(['Manage Locations']);
    renderWorkspace('amach');
    await screen.findByDisplayValue('Amach HCIV');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());
    const readsBefore = locationReads();

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(closeWorkspace).toHaveBeenCalledWith({ discardUnsavedChanges: true }));
    expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ title: 'Clinic saved' }));
    await waitFor(() => expect(locationReads()).toBeGreaterThan(readsBefore));
  });

  it('says so when the clinic to edit is not among the clinics loaded', async () => {
    backend();
    await signInWith(['Manage Locations']);
    renderWorkspace('nobody');

    expect(await screen.findByText('Could not load this clinic')).toBeInTheDocument();
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  it('says so when the clinics cannot be read at all', async () => {
    mockOpenmrsFetch.mockRejectedValue(new Error('Down'));
    await signInWith(['Manage Locations']);
    renderWorkspace('amach');

    expect(await screen.findByText('Could not load this clinic')).toBeInTheDocument();
  });

  it('asks the framework to guard unsaved changes only once a field is edited, and cancels on Cancel', async () => {
    backend();
    await signInWith(['Manage Locations']);
    renderWorkspace('amach');
    await screen.findByDisplayValue('Amach HCIV');
    const guard = () => vi.mocked(Workspace2).mock.lastCall[0].hasUnsavedChanges;
    expect(guard()).toBe(false);

    await userEvent.type(screen.getByLabelText('Name'), 'x');
    expect(guard()).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(closeWorkspace).toHaveBeenCalledWith();
  });
});
