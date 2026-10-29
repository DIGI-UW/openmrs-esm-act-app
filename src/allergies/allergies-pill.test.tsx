import React from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getDefaultsFromConfigSchema, openmrsFetch } from '@openmrs/esm-framework';
import { day } from '../consultations/repeated-lists.component';
import { signInWith } from '../access/sign-in.test-helper';
import { type Config, configSchema } from '../config-schema';
import { type ChartEncounter } from '../consultations/consultations.resource';
import AllergiesPill from './allergies-pill.component';

const config = getDefaultsFromConfigSchema(configSchema) as Config;
const c = config.consultations.concepts;
const [penicillinAllergy] = config.consultations.penicillinAllergyAnswers;
const coded = (uuid: string, display: string) => ({ uuid, display });
const obs = (concept: string, value: unknown, groupMembers?: Array<unknown>) => ({
  concept: { uuid: concept },
  value,
  groupMembers,
});
const allergy = (answer: object, added?: string) =>
  obs(c.allergy, null, [obs(c.allergy, answer), ...(added ? [obs(c.dateAdded, added)] : [])]);
const consultation = (uuid: string, date: string, obsList: Array<unknown> = []): ChartEncounter =>
  ({ uuid, encounterDatetime: `${date}T09:00:00.000+0300`, encounterProviders: [], obs: obsList }) as ChartEncounter;

const penicillin = coded(penicillinAllergy, 'Penicillin (allergy)');
const named = (name: string) => coded(`${name}-uuid`, name);

const serve = (encounters: Array<ChartEncounter>) =>
  vi.mocked(openmrsFetch).mockResolvedValue({ data: { results: encounters, totalCount: encounters.length } } as never);

const renderPill = () =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <AllergiesPill patientUuid="abebe" />
    </SWRConfig>,
  );

describe('the patient banner allergies pill', () => {
  beforeEach(async () => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    await signInWith(['Get Encounters', 'Get Observations']);
  });

  it('names the allergies and marks a penicillin allergy', async () => {
    serve([consultation('one', '2026-04-01', [allergy(named('Other')), allergy(penicillin)])]);

    renderPill();

    const pill = await screen.findByTestId('allergies-pill');
    expect(pill).toHaveTextContent('Allergies: Penicillin (allergy), Other');
    expect(pill).toHaveAttribute('data-tone', 'penicillin');
    expect(within(pill).getByText(/^Allergies:/, { selector: '.cds--tag--red .cds--tag__label' })).toBeInTheDocument();
  });

  it('is not marked for an allergy that is not to penicillin', async () => {
    serve([consultation('one', '2026-04-01', [allergy(named('Latex'))])]);

    renderPill();

    const pill = await screen.findByTestId('allergies-pill');
    expect(pill).toHaveTextContent('Allergies: Latex');
    expect(pill).toHaveAttribute('data-tone', 'other');
    expect(within(pill).getByText(/^Allergies:/, { selector: '.cds--tag--gray .cds--tag__label' })).toBeInTheDocument();
  });

  it('keeps the banner short for several allergies and lists them all, with their dates, on a click', async () => {
    serve([
      consultation('one', '2026-04-01', [
        allergy(penicillin, '2026-04-01'),
        allergy(named('Latex'), '2026-03-01'),
        allergy(named('Peanuts'), '2026-02-01'),
        allergy(named('Dust'), '2026-01-01'),
      ]),
    ]);

    renderPill();

    const pill = await screen.findByTestId('allergies-pill');
    expect(pill).toHaveTextContent('Allergies: Penicillin (allergy), Latex, +2');
    await userEvent.click(within(pill).getByRole('button'));
    const list = await screen.findByRole('list', { name: 'Allergies' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(4);
    expect(list).toHaveTextContent('Peanuts');
    expect(list).toHaveTextContent('Dust');
    expect(list).toHaveTextContent(`Latex (added ${day('2026-03-01')})`);
    expect(list).toHaveTextContent(`Dust (added ${day('2026-01-01')})`);
    expect(day('2026-03-01')).not.toBe(day('2026-01-01'));
    expect(screen.getByRole('link', { name: 'Review in Consultation visits' })).toHaveAttribute(
      'href',
      '/openmrs/spa/patient/abebe/chart/act-consultations',
    );
  });

  it('keeps an allergy an older consultation recorded and a later one does not repeat', async () => {
    serve([
      consultation('new', '2026-04-01', [allergy(named('Latex'))]),
      consultation('old', '2025-10-01', [allergy(penicillin)]),
    ]);

    renderPill();

    expect(await screen.findByTestId('allergies-pill')).toHaveAttribute('data-tone', 'penicillin');
  });

  it('says allergies are not recorded, never that there are none, when no consultation lists one', async () => {
    serve([consultation('one', '2026-04-01')]);

    renderPill();

    const pill = await screen.findByTestId('allergies-pill');
    expect(pill).toHaveTextContent('Allergies not recorded');
    expect(pill).toHaveAttribute('data-tone', 'none');
    expect(screen.queryByText(/No known allergies/)).not.toBeInTheDocument();
  });

  it('shows nothing while the allergies load, so a patient is never shown as having none', async () => {
    vi.mocked(openmrsFetch).mockReturnValue(new Promise(() => {}) as never);

    renderPill();

    expect(screen.queryByTestId('allergies-pill')).not.toBeInTheDocument();
  });

  it('says the allergies are unavailable, never none, when they cannot be read', async () => {
    vi.mocked(openmrsFetch).mockRejectedValue(new Error('403'));

    renderPill();

    const pill = await screen.findByTestId('allergies-pill');
    expect(pill).toHaveTextContent('Allergies unavailable');
    expect(pill).toHaveAttribute('data-tone', 'unavailable');
  });
});
