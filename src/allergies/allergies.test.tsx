import React from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getDefaultsFromConfigSchema, openmrsFetch } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { type Config, configSchema } from '../config-schema';
import { type ChartEncounter } from '../consultations/consultations.resource';
import Allergies from './allergies.component';

// Opening a form in a visit is open-form-in-visit's own test; here it records which form was opened.
const openForm = vi.fn();
vi.mock('../visits/open-form-in-visit', () => ({
  useOpenFormInVisit: vi.fn(() => ({ open: openForm, isOpening: false })),
}));

const config = getDefaultsFromConfigSchema(configSchema) as Config;
const c = config.consultations.concepts;
const a = config.allergies.concepts;
const coded = (uuid: string, display: string) => ({ uuid, display });
const obs = (concept: string, value: unknown, groupMembers?: Array<unknown>) => ({
  concept: { uuid: concept },
  value,
  groupMembers,
});
const allergy = (answer: object, added: string, { reactions = [] as Array<string>, resolved = '' } = {}) =>
  obs(c.allergy, null, [
    obs(c.allergy, answer),
    ...(reactions.length
      ? [
          obs(
            a.reaction,
            null,
            reactions.map((name) => obs(a.reaction, coded(name, name))),
          ),
        ]
      : []),
    obs(c.dateAdded, added),
    ...(resolved ? [obs(a.dateResolved, resolved)] : []),
  ]);
const encounter = (uuid: string, date: string, obsList: Array<unknown> = []): ChartEncounter =>
  ({ uuid, encounterDatetime: `${date}T09:00:00.000+0300`, encounterProviders: [], obs: obsList }) as ChartEncounter;

const anaphylaxis = coded(config.consultations.penicillinAllergyAnswers[1], 'Penicillin (anaphylaxis)');
const penicillin = coded(config.consultations.penicillinAllergyAnswers[0], 'Penicillin (allergy)');
const other = coded('5622AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'Other');

function serve({
  consultations = [] as Array<ChartEncounter>,
  records = [] as Array<ChartEncounter>,
  mayEnter = true,
} = {}) {
  vi.mocked(openmrsFetch).mockImplementation((async (url: string) => {
    if (url.includes(`encounterType=${config.consultations.encounterType}`)) {
      return { data: { results: consultations, totalCount: consultations.length } };
    }
    if (url.includes(`encounterType=${config.allergies.encounterType}`)) {
      return { data: { results: records, totalCount: records.length } };
    }
    if (url.includes('/form/')) {
      return {
        data: { uuid: 'form', encounterType: { editPrivilege: mayEnter ? null : { display: 'Task: nobody' } } },
      };
    }
    return { data: { results: [], totalCount: 0 } };
  }) as never);
}

const renderPage = () =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <Allergies patientUuid="mary" />
    </SWRConfig>,
  );

describe('the Allergies page', () => {
  beforeEach(async () => {
    openForm.mockClear();
    await signInWith(['Add Encounters', 'Get Encounters', 'Get Observations', 'Task: act.enterAllergies']);
  });

  it('lists current and past allergies with their reactions, as the Medications page lists medicines', async () => {
    serve({
      consultations: [
        encounter('visit', '2025-03-03', [allergy(other, '2025-03-03', { reactions: ['Rash (itchy or red)'] })]),
      ],
      records: [
        encounter('new', '2026-10-12', [
          allergy(anaphylaxis, '2026-10-12', { reactions: ['Anaphylaxis', 'Wheezing'] }),
        ]),
        encounter('old', '2026-10-12', [allergy(penicillin, '2024-01-14', { resolved: '2026-10-12' })]),
      ],
    });

    renderPage();

    const current = await screen.findByRole('table', { name: 'Current allergies' });
    const rows = within(current).getAllByRole('row').slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringMatching(/Oct.*2026.*Penicillin \(anaphylaxis\) · REACTION Anaphylaxis, Wheezing/),
      expect.stringMatching(/Mar.*2025.*Other · REACTION Rash \(itchy or red\)/),
    ]);
    expect(within(current).queryByRole('columnheader', { name: 'Date resolved' })).not.toBeInTheDocument();
    const past = screen.getByRole('table', { name: 'Past allergies' });
    expect(within(past).getByRole('columnheader', { name: 'Date resolved' })).toBeInTheDocument();
    expect(within(past).getAllByRole('row')[1]).toHaveTextContent(/Jan.*2024.*Penicillin \(allergy\).*Oct.*2026/);
  });

  it("marks a penicillin allergy's name, as the banner does", async () => {
    serve({
      records: [encounter('new', '2026-10-12', [allergy(anaphylaxis, '2026-10-12'), allergy(other, '2026-10-12')])],
    });

    renderPage();

    const current = await screen.findByRole('table', { name: 'Current allergies' });
    expect(within(current).getByText('Penicillin (anaphylaxis)')).toHaveAttribute('data-tone', 'penicillin');
    expect(within(current).getByText('Other')).not.toHaveAttribute('data-tone', 'penicillin');
  });

  it('opens the RHD Allergies form from Add, and from Edit reopens the record or, for a consultation, records anew', async () => {
    serve({
      consultations: [encounter('visit', '2025-03-03', [allergy(other, '2025-03-03')])],
      records: [encounter('new', '2026-10-12', [allergy(anaphylaxis, '2026-10-12')])],
    });

    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /^Add/ }));
    expect(openForm).toHaveBeenLastCalledWith(config.allergies.form);
    await userEvent.click(screen.getByRole('button', { name: 'Edit Penicillin (anaphylaxis)' }));
    expect(openForm).toHaveBeenLastCalledWith(config.allergies.form, undefined, 'new');
    // The consultation no longer asks for allergies, so its allergy is updated on a new RHD Allergies record.
    await userEvent.click(screen.getByRole('button', { name: 'Edit Other' }));
    expect(openForm).toHaveBeenLastCalledWith(config.allergies.form);
  });

  it('shows the allergies without Add or Edit to a user who may not record RHD Allergies', async () => {
    serve({ records: [encounter('new', '2026-10-12', [allergy(other, '2026-10-12')])], mayEnter: false });

    renderPage();

    expect(await screen.findByRole('table', { name: 'Current allergies' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Add|^Edit/ })).not.toBeInTheDocument();
  });

  it('shows the empty cards the Medications page shows when no allergy is recorded', async () => {
    serve();

    renderPage();

    expect(await screen.findByText(/There are no current allergies to display/)).toBeInTheDocument();
    expect(screen.getByText(/There are no past allergies to display/)).toBeInTheDocument();
  });
});
