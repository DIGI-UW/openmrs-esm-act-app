import React from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getDefaultsFromConfigSchema, openmrsFetch } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { type Config, configSchema } from '../config-schema';
import { type ChartEncounter } from './consultations.resource';
import { diagnosisConcepts } from './patient-details.resource';
import ConsultationsPage, { Diagnoses } from './repeated-lists.component';
import { toListedItems } from './repeated-lists.resource';

// Opening a form in a visit is open-form-in-visit's own test; here it records which form was opened.
const openForm = vi.fn();
vi.mock('../visits/open-form-in-visit', () => ({
  useOpenFormInVisit: vi.fn(() => ({ open: openForm, isOpening: false })),
}));

const config = getDefaultsFromConfigSchema(configSchema) as Config;
const c = config.consultations.concepts;
const coded = (uuid: string, display: string) => ({ uuid, display });
const obs = (concept: string, value: unknown, groupMembers?: Array<unknown>) => ({
  concept: { uuid: concept },
  value,
  groupMembers,
});

const warfarin = coded(config.consultations.vitaminKAntagonists[0], 'Warfarin');
const aspirin = coded('aspirin', 'Aspirin');
const furosemide = coded('furosemide', 'Furosemide');

/** A medication group as the form saves it: the group and the medicine share one concept. */
const medication = (medicine: object, extra: Array<[string, unknown]> = []) =>
  obs(c.medication, null, [obs(c.medication, medicine), ...extra.map(([concept, value]) => obs(concept, value))]);

const consultation = (uuid: string, date: string, obsList: Array<unknown> = []): ChartEncounter =>
  ({ uuid, encounterDatetime: `${date}T09:00:00.000+0300`, encounterProviders: [], obs: obsList }) as ChartEncounter;

describe('toListedItems', () => {
  it('lists each item once, newest first, dated by its Date Added or else the first consultation to record it', () => {
    const condition = (name: object, added?: string) =>
      obs(c.chronicCondition, null, [obs(c.chronicCondition, name), ...(added ? [obs(c.dateAdded, added)] : [])]);
    const items = toListedItems(
      [
        consultation('new', '2026-04-01', [condition(coded('asthma', 'Asthma')), condition(coded('hiv', 'HIV'))]),
        consultation('old', '2025-10-01', [condition(coded('hiv', 'HIV'))]),
      ],
      c,
      c.chronicCondition,
    );

    expect(items.map((one) => one.name)).toEqual(['Asthma', 'HIV']);
    expect(items[1].added).toBe('2025-10-01T09:00:00.000+0300');
    // Edit reopens the latest consultation that records the item, whatever order they come in
    expect(items[1].encounterUuid).toBe('new');
    expect(
      toListedItems(
        [
          consultation('old', '2025-10-01', [condition(coded('hiv', 'HIV'))]),
          consultation('new', '2026-04-01', [condition(coded('hiv', 'HIV'))]),
        ],
        c,
        c.chronicCondition,
      )[0].encounterUuid,
    ).toBe('new');
  });

  it('prefers a recorded Date Added to any consultation date, taking the earliest recorded', () => {
    const condition = (added?: string) =>
      obs(c.chronicCondition, null, [
        obs(c.chronicCondition, coded('hiv', 'HIV')),
        ...(added ? [obs(c.dateAdded, added)] : []),
      ]);
    const added = (...records: Array<[string, string?]>) =>
      toListedItems(
        records.map(([date, recorded], index) => consultation(`c${index}`, date, [condition(recorded)])),
        c,
        c.chronicCondition,
      )[0].added;

    expect(added(['2026-04-01'], ['2025-10-01', '2025-06-01'])).toBe('2025-06-01');
    expect(added(['2026-04-01', '2026-03-01'], ['2025-10-01'])).toBe('2026-03-01');
    expect(added(['2026-04-01', '2026-03-01'], ['2025-10-01', '2026-01-01'])).toBe('2026-01-01');
  });
});

function serve({
  consultations = [] as Array<ChartEncounter>,
  patientInformation = [] as Array<ChartEncounter>,
  mayEnter = true,
} = {}) {
  vi.mocked(openmrsFetch).mockImplementation((async (url: string) => {
    if (url.includes(`encounterType=${config.consultations.encounterType}`)) {
      return { data: { results: consultations, totalCount: consultations.length } };
    }
    if (url.includes(`encounterType=${diagnosisConcepts.encounterType}`)) {
      return { data: { results: patientInformation, totalCount: patientInformation.length } };
    }
    if (url.includes('/form/')) {
      return {
        data: { uuid: 'form', encounterType: { editPrivilege: mayEnter ? null : { display: 'Task: nobody' } } },
      };
    }
    return { data: { results: [], totalCount: 0 } };
  }) as never);
}

const renderIn = (element: React.ReactElement) =>
  render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{element}</SWRConfig>);

describe('the Consultation visits page tables', () => {
  beforeEach(async () => {
    openForm.mockClear();
    await signInWith(['Add Encounters', 'Get Encounters', 'Get Observations', 'Task: act.enterClinicalForms']);
  });

  it('shows every diagnosis with its status and dates', async () => {
    const diagnosis = (name: string, active: string) =>
      obs(diagnosisConcepts.group, null, [
        obs(diagnosisConcepts.category, coded(name, name)),
        obs(diagnosisConcepts.active, coded(active, active)),
        obs(diagnosisConcepts.started, '2025-02-03'),
      ]);
    serve({
      patientInformation: [
        {
          uuid: 'pi',
          encounterDatetime: '2026-03-01T09:00:00.000+0300',
          obs: [diagnosis('Rheumatic Heart Disease', 'Yes'), diagnosis('Congenital', 'No')],
        } as ChartEncounter,
      ],
    });

    renderIn(<Diagnoses patientUuid="winnie" />);

    const rows = await screen.findAllByTestId('repeated-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent(/Rheumatic Heart Disease.*Yes.*Feb.*2025/);
    expect(rows[1]).toHaveTextContent(/Congenital.*No/);
  });

  it('shows only the diagnoses of the latest Patient Information', async () => {
    const diagnosis = (name: string) =>
      obs(diagnosisConcepts.group, null, [obs(diagnosisConcepts.category, coded(name, name))]);
    const record = (uuid: string, date: string, name: string) =>
      ({ uuid, encounterDatetime: `${date}T09:00:00.000+0300`, obs: [diagnosis(name)] }) as ChartEncounter;
    serve({
      patientInformation: [
        record('older', '2025-03-01', 'Congenital'),
        record('latest', '2026-03-01', 'Rheumatic Heart Disease'),
      ],
    });

    renderIn(<Diagnoses patientUuid="winnie" />);

    const rows = await screen.findAllByTestId('repeated-row');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Rheumatic Heart Disease');
  });

  it('shows chronic conditions, allergies and RHD complications each once', async () => {
    const item = (list: string, name: string) => obs(list, null, [obs(list, coded(name, name))]);
    serve({
      consultations: [
        consultation('new', '2026-04-01', [
          item(c.chronicCondition, 'Asthma'),
          item(c.allergy, 'Penicillin'),
          item(c.complication, 'Atrial fibrillation'),
        ]),
        consultation('old', '2025-10-01', [item(c.chronicCondition, 'Asthma')]),
      ],
    });

    renderIn(<ConsultationsPage patientUuid="winnie" />);

    const conditions = await screen.findByRole('table', { name: 'Chronic health conditions' });
    expect(within(conditions).getAllByTestId('repeated-row')).toHaveLength(1);
    expect(within(screen.getByRole('table', { name: 'Allergies' })).getByText('Penicillin')).toBeInTheDocument();
    expect(
      within(screen.getByRole('table', { name: 'RHD complications' })).getByText('Atrial fibrillation'),
    ).toBeInTheDocument();
  });

  it("reopens a diagnosis's Patient Information, and an item's latest consultation, from its Edit", async () => {
    const item = (list: string, name: string) => obs(list, null, [obs(list, coded(name, name))]);
    serve({
      consultations: [
        consultation('new', '2026-04-01', [item(c.allergy, 'Penicillin')]),
        consultation('old', '2025-10-01', [item(c.allergy, 'Penicillin'), item(c.complication, 'Stroke')]),
      ],
      patientInformation: [
        {
          uuid: 'pi',
          encounterDatetime: '2026-03-01T09:00:00.000+0300',
          obs: [obs(diagnosisConcepts.group, null, [obs(diagnosisConcepts.category, coded('rhd', 'RHD'))])],
        } as ChartEncounter,
      ],
    });

    renderIn(<ConsultationsPage patientUuid="winnie" />);

    await userEvent.click(await screen.findByRole('button', { name: 'Edit RHD' }));
    expect(openForm).toHaveBeenLastCalledWith(config.patientInformationForm, undefined, 'pi');
    await userEvent.click(
      await screen.findByRole('button', { name: /^Edit Penicillin in the consultation of .*Apr.*2026$/ }),
    );
    expect(openForm).toHaveBeenLastCalledWith(config.consultations.form, undefined, 'new');
    await userEvent.click(screen.getByRole('button', { name: /^Edit Stroke in the consultation of .*Oct.*2025$/ }));
    expect(openForm).toHaveBeenLastCalledWith(config.consultations.form, undefined, 'old');
  });

  it('shows the tables without Edit to a user who may not record the forms', async () => {
    const item = (list: string, name: string) => obs(list, null, [obs(list, coded(name, name))]);
    serve({
      consultations: [consultation('new', '2026-04-01', [item(c.allergy, 'Penicillin')])],
      patientInformation: [
        {
          uuid: 'pi',
          encounterDatetime: '2026-03-01T09:00:00.000+0300',
          obs: [obs(diagnosisConcepts.group, null, [obs(diagnosisConcepts.category, coded('rhd', 'RHD'))])],
        } as ChartEncounter,
      ],
      mayEnter: false,
    });

    renderIn(<ConsultationsPage patientUuid="winnie" />);

    await within(await screen.findByRole('table', { name: 'Allergies' })).findByText('Penicillin');
    await screen.findByText('RHD');
    expect(screen.queryByRole('button', { name: /^Edit/ })).not.toBeInTheDocument();
  });
});
