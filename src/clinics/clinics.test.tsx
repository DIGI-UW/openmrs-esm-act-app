import React from 'react';
import { SWRConfig } from 'swr';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { openmrsFetch } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import { signInWith } from '../access/sign-in.test-helper';
import Clinics from './clinics.component';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const tagUuids: Record<string, string> = {
  'RHD Tertiary': 'tag-tertiary',
  'RHD District': 'tag-district',
  'RHD Community': 'tag-community',
  'Visit Location': 'tag-visit',
  'Queue Location': 'tag-queue',
  'Login Location': 'tag-login',
  'Main Pharmacy': 'tag-pharmacy',
};
const tags = (...names: Array<string>) => names.map((display) => ({ uuid: tagUuids[display], display }));
const working = ['Visit Location', 'Queue Location', 'Login Location'];

// As the distro seeds a clinic: type and level in its description, a level tag and the working tags.
const locations = [
  {
    uuid: 'uhi',
    name: 'Uganda Heart Institute Tertiary',
    description: 'Public, Tertiary level',
    retired: false,
    tags: tags('RHD Tertiary', ...working),
    parentLocation: null,
  },
  {
    uuid: 'lira',
    name: 'Lira Regional Referral Hospital',
    description: 'Public, District level',
    retired: false,
    tags: tags('RHD District', ...working),
    parentLocation: { uuid: 'uhi', display: 'Uganda Heart Institute Tertiary' },
  },
  {
    uuid: 'jcrc',
    name: 'JCRC Lubowa',
    description: 'Private Not-For-Profit, District level',
    retired: false,
    tags: tags('RHD District', ...working),
    parentLocation: { uuid: 'uhi', display: 'Uganda Heart Institute Tertiary' },
  },
  {
    uuid: 'amach',
    name: 'Amach HCIV',
    description: 'Public, Community level',
    retired: false,
    tags: tags('RHD Community', ...working),
    parentLocation: { uuid: 'lira', display: 'Lira Regional Referral Hospital' },
  },
  {
    uuid: 'noclinic',
    name: 'No Clinic',
    description: 'No Designation, District level',
    retired: false,
    tags: tags('RHD District'),
    parentLocation: null,
  },
  {
    uuid: 'closed',
    name: 'Closed HCIII',
    description: 'Public, Community level',
    retired: true,
    tags: tags('RHD Community', ...working),
    parentLocation: { uuid: 'lira', display: 'Lira Regional Referral Hospital' },
  },
  {
    uuid: 'old-district',
    name: 'Old District Hospital',
    description: 'Public, District level',
    retired: true,
    tags: tags('RHD District', ...working),
    parentLocation: null,
  },
  {
    uuid: 'mbale',
    name: 'Mbale HCIV',
    description: 'Public, Community level',
    retired: false,
    tags: tags('RHD Community', ...working),
    parentLocation: { uuid: 'old-district', display: 'Old District Hospital' },
  },
  {
    uuid: 'pharmacy',
    name: 'Main Pharmacy',
    description: null,
    retired: false,
    tags: tags('Main Pharmacy'),
    parentLocation: null,
  },
];

type Call = { url: string; method: string; body: unknown };

/** Pages locations by four, so a test proves every page is read. */
function backend(fails?: string) {
  const writes: Array<Call> = [];
  mockOpenmrsFetch.mockImplementation((async (url: string, init?: { method?: string; body?: unknown }) => {
    const method = init?.method ?? 'GET';
    if (method !== 'GET') {
      writes.push({ url, method, body: init?.body });
      if (fails) {
        throw Object.assign(new Error('400'), { responseBody: { error: { message: fails } } });
      }
      return { data: { uuid: 'new-clinic' } };
    }
    if (url.includes('/locationtag?')) {
      return { data: { results: Object.entries(tagUuids).map(([display, uuid]) => ({ uuid, display })) } };
    }
    if (url.includes('/location?')) {
      expect(url).toContain('includeAll=true');
      const start = Number(new URLSearchParams(url.split('?')[1]).get('startIndex') ?? 0);
      return { data: { results: locations.slice(start, start + 4), totalCount: locations.length } };
    }
    return { data: {} };
  }) as never);
  return writes;
}

function renderPage() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <Clinics />
    </SWRConfig>,
  );
}

const rows = async () =>
  (await screen.findAllByTestId('act-clinic-row')).map((row) =>
    within(row)
      .getAllByRole('cell')
      .map((cell) => cell.textContent),
  );

// By the Name cell, as a clinic's name is also its children's Parent.
const rowOf = async (name: string) =>
  (await screen.findAllByTestId('act-clinic-row')).find(
    (row) => within(row).getAllByRole('cell')[0].textContent === name,
  );

describe('Clinics', () => {
  it("lists the enabled clinics, every page of them, with each one's type, level, parent and status", async () => {
    backend();
    await signInWith(['Manage Locations']);

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Clinics' })).toBeInTheDocument();
    expect((await rows()).map((cells) => cells.slice(0, 5))).toEqual([
      ['Amach HCIV', 'Public', 'Community', 'Lira Regional Referral Hospital', 'Enabled'],
      ['JCRC Lubowa', 'Private Not-For-Profit', 'District', 'Uganda Heart Institute Tertiary', 'Enabled'],
      ['Lira Regional Referral Hospital', 'Public', 'District', 'Uganda Heart Institute Tertiary', 'Enabled'],
      ['Mbale HCIV', 'Public', 'Community', 'Old District Hospital', 'Enabled'],
      ['No Clinic', 'No Designation', 'District', '--', 'Enabled'],
      ['Uganda Heart Institute Tertiary', 'Public', 'Tertiary', '--', 'Enabled'],
    ]);
    expect(screen.queryByText(/clinicLocationTags/)).not.toBeInTheDocument();
  });

  it('warns when a level tag is in neither clinicLocationTags list, as those clinics would be no clinic elsewhere', async () => {
    const t = vi.spyOn(useTranslation(), 't');
    backend();
    await signInWith(['Manage Locations'], {
      clinicLocationTags: { cardiac: ['Cardiac Tertiary', 'RHD District'], primaryCare: ['RHD Community'] },
    });
    renderPage();
    await rows();

    expect(
      screen.getByText(
        'These clinic level tags are not in clinicLocationTags, so the rest of ACT does not count their clinics: RHD Tertiary',
      ),
    ).toBeInTheDocument();
    expect(t).toHaveBeenCalledWith(
      'levelTagsNotInClinicLocationTags',
      expect.any(String),
      expect.objectContaining({ interpolation: { escapeValue: false } }),
    );
    t.mockRestore();
  });

  it('shows the disabled clinics too under All, and finds a clinic by its name, type, level or parent', async () => {
    backend();
    await signInWith(['Manage Locations']);
    renderPage();
    await rows();

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'all');
    expect((await rows()).map((cells) => [cells[0], cells[4]])).toContainEqual(['Closed HCIII', 'Disabled']);

    await userEvent.type(screen.getByRole('searchbox'), 'lira');
    expect((await rows()).map((cells) => cells[0])).toEqual([
      'Amach HCIV',
      'Closed HCIII',
      'Lira Regional Referral Hospital',
    ]);

    await userEvent.clear(screen.getByRole('searchbox'));
    await userEvent.type(screen.getByRole('searchbox'), 'not-for-profit');
    expect((await rows()).map((cells) => cells[0])).toEqual(['JCRC Lubowa']);

    await userEvent.clear(screen.getByRole('searchbox'));
    // JCRC Lubowa matches on its level alone.
    await userEvent.type(screen.getByRole('searchbox'), 'district');
    expect((await rows()).map((cells) => cells[0])).toEqual([
      'JCRC Lubowa',
      'Lira Regional Referral Hospital',
      'Mbale HCIV',
      'No Clinic',
      'Old District Hospital',
    ]);
  });

  it('adds a clinic with its level and the working tags, its parent, and its type and level in the description', async () => {
    const writes = backend();
    await signInWith(['Manage Locations']);
    renderPage();
    await rows();

    await userEvent.click(screen.getByRole('button', { name: 'Add clinic' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(within(dialog).getByText('Enter the clinic name')).toBeInTheDocument();
    expect(within(dialog).getByText('Choose the clinic level')).toBeInTheDocument();
    expect(within(dialog).getByText('Choose the clinic type')).toBeInTheDocument();
    expect(writes).toHaveLength(0);

    await userEvent.type(within(dialog).getByLabelText('Name'), '  Ober HCIV ');
    await userEvent.selectOptions(within(dialog).getByLabelText('Level'), 'Community');
    await userEvent.selectOptions(within(dialog).getByLabelText('Type'), 'Private For-Profit');
    await userEvent.selectOptions(within(dialog).getByLabelText('Parent clinic'), 'lira');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

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
    renderPage();
    await rows();

    await userEvent.click(
      within(await rowOf('Lira Regional Referral Hospital')).getByRole('button', { name: 'Edit clinic' }),
    );
    const parents = within(within(await screen.findByRole('dialog')).getByLabelText('Parent clinic'))
      .getAllByRole('option')
      .map((option) => option.textContent);

    expect(parents).toEqual(['None', 'JCRC Lubowa', 'No Clinic', 'Uganda Heart Institute Tertiary']);
  });

  it("still offers a clinic's disabled parent, and no other disabled clinic", async () => {
    backend();
    await signInWith(['Manage Locations']);
    renderPage();
    const mbale = await rowOf('Mbale HCIV');

    await userEvent.click(within(mbale).getByRole('button', { name: 'Edit clinic' }));
    const parent = within(await screen.findByRole('dialog')).getByLabelText('Parent clinic');

    expect(parent).toHaveValue('old-district');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    const lira = await rowOf('Lira Regional Referral Hospital');
    await userEvent.click(within(lira).getByRole('button', { name: 'Edit clinic' }));
    const options = within(within(await screen.findByRole('dialog')).getByLabelText('Parent clinic'))
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(options).not.toContain('Old District Hospital');
  });

  it("edits a clinic's name, level and type, keeping its other tags, and disables it", async () => {
    const writes = backend();
    await signInWith(['Manage Locations']);
    renderPage();
    await rows();

    await userEvent.click(
      within(await rowOf('Lira Regional Referral Hospital')).getByRole('button', { name: 'Edit clinic' }),
    );
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Lira Regional Referral Hospital');
    expect(within(dialog).getByLabelText('Type')).toHaveValue('Public');
    expect(within(dialog).getByLabelText('Level')).toHaveValue('District');
    expect(within(dialog).getByLabelText('Parent clinic')).toHaveValue('uhi');

    await userEvent.clear(within(dialog).getByLabelText('Name'));
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Lira RRH');
    await userEvent.selectOptions(within(dialog).getByLabelText('Level'), 'Tertiary');
    await userEvent.selectOptions(within(dialog).getByLabelText('Type'), 'Private Not-For-Profit');
    await userEvent.selectOptions(within(dialog).getByLabelText('Parent clinic'), '');
    await userEvent.selectOptions(within(dialog).getByLabelText('Status'), 'disabled');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

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

  it("hands the edit heading the clinic's name unescaped, as a name such as St. Joseph's carries an apostrophe", async () => {
    const t = vi.spyOn(useTranslation(), 't');
    backend();
    await signInWith(['Manage Locations']);
    renderPage();
    await rows();

    await userEvent.click(within(await rowOf('Amach HCIV')).getByRole('button', { name: 'Edit clinic' }));
    await screen.findByRole('dialog');
    expect(t).toHaveBeenCalledWith(
      'editClinicNamed',
      expect.any(String),
      expect.objectContaining({ name: 'Amach HCIV', interpolation: { escapeValue: false } }),
    );
    t.mockRestore();
  });

  it("keeps a clinic's type that is none of the three, and enables a disabled clinic", async () => {
    const writes = backend();
    await signInWith(['Manage Locations']);
    renderPage();
    await rows();

    await userEvent.click(within(await rowOf('No Clinic')).getByRole('button', { name: 'Edit clinic' }));
    let dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Type')).toHaveValue('No Designation');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0].body).toMatchObject({ description: 'No Designation, District level', tags: ['tag-district'] });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'all');
    const closed = (await screen.findAllByTestId('act-clinic-row')).find((row) =>
      within(row).queryByText('Closed HCIII'),
    );
    await userEvent.click(within(closed).getByRole('button', { name: 'Edit clinic' }));
    dialog = await screen.findByRole('dialog');
    await userEvent.selectOptions(within(dialog).getByLabelText('Status'), 'enabled');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(writes).toHaveLength(3));
    expect(writes[2]).toEqual({
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
    renderPage();
    await rows();

    await userEvent.click(screen.getByRole('button', { name: 'Add clinic' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Ober HCIV');
    await userEvent.selectOptions(within(dialog).getByLabelText('Level'), 'District');
    await userEvent.selectOptions(within(dialog).getByLabelText('Type'), 'Public');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(
      await within(dialog).findByText(
        'The server has no location tag named Triage Location; ask an administrator to add it',
      ),
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
    renderPage();
    await rows();

    await userEvent.click(screen.getByRole('button', { name: 'Add clinic' }));
    const dialog = await screen.findByRole('dialog');

    expect(
      await within(dialog).findByText('Could not load the location tags, so the clinic cannot be saved'),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it("shows the server's reason when it refuses a clinic, and keeps the dialog open", async () => {
    backend('A location with this name already exists');
    await signInWith(['Manage Locations']);
    renderPage();
    await rows();

    await userEvent.click(screen.getByRole('button', { name: 'Add clinic' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Lira Regional Referral Hospital');
    await userEvent.selectOptions(within(dialog).getByLabelText('Level'), 'District');
    await userEvent.selectOptions(within(dialog).getByLabelText('Type'), 'Public');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    expect(await within(dialog).findByText('A location with this name already exists')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
