import React from 'react';
import { SWRConfig } from 'swr';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { launchWorkspace2 } from '@openmrs/esm-framework';
import { useTranslation } from 'react-i18next';
import { signInWith } from '../access/sign-in.test-helper';
import { restoresOpenWorkspace } from '../workspace-props.test-helper';
import Clinics from './clinics.component';
import { backend } from './clinics.test-helper';

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

  it('launches the clinic form to add a clinic, and to edit the one clicked', async () => {
    backend();
    await signInWith(['Manage Locations']);
    renderPage();
    await rows();

    await userEvent.click(screen.getByRole('button', { name: 'Add clinic' }));
    expect(launchWorkspace2).toHaveBeenLastCalledWith('act-clinic-form-workspace', { clinicUuid: undefined });
    await userEvent.click(within(await rowOf('Amach HCIV')).getByRole('button', { name: 'Edit clinic' }));
    expect(launchWorkspace2).toHaveBeenLastCalledWith('act-clinic-form-workspace', { clinicUuid: 'amach' });
  });

  it('does not bring back the open Add clinic form for Edit clinic, or the open Edit form for Add clinic', async () => {
    backend();
    await signInWith(['Manage Locations']);
    renderPage();
    const propsOfLaunch = () => vi.mocked(launchWorkspace2).mock.lastCall[1] as Record<string, unknown>;
    await rows();

    await userEvent.click(screen.getByRole('button', { name: 'Add clinic' }));
    const add = propsOfLaunch();
    await userEvent.click(within(await rowOf('Amach HCIV')).getByRole('button', { name: 'Edit clinic' }));
    const edit = propsOfLaunch();

    expect(restoresOpenWorkspace(add, edit)).toBe(false);
    expect(restoresOpenWorkspace(edit, add)).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Add clinic' }));
    expect(restoresOpenWorkspace(add, propsOfLaunch())).toBe(true);
  });
});
