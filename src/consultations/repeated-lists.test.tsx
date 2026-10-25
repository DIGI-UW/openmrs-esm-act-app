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
import ConsultationsPage, { CardiacMedications, Diagnoses } from './repeated-lists.component';
import { toListedItems, toMedications } from './repeated-lists.resource';

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

describe('toMedications', () => {
  it('shows a medicine carried through several consultations once, started at the first that recorded it', () => {
    const { active, past } = toMedications(
      [
        consultation('new', '2026-04-01', [medication(warfarin, [[c.medicationDose, '5 mg']])]),
        consultation('old', '2025-10-01', [medication(warfarin, [[c.medicationDose, '3 mg']])]),
      ],
      c,
    );

    expect(past).toEqual([]);
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({ name: 'Warfarin', dose: '5 mg', stopped: null });
    expect(active[0].started).toBe('2025-10-01T09:00:00.000+0300');
  });

  it('keeps the Date Started a consultation records over the consultation date', () => {
    const { active } = toMedications(
      [consultation('new', '2026-04-01', [medication(warfarin, [[c.dateStarted, '2025-06-15']])])],
      c,
    );

    expect(active[0].started).toBe('2025-06-15');
  });

  it('moves a medicine to Past only once a consultation records its Date Stopped', () => {
    const { active, past } = toMedications(
      [
        consultation('new', '2026-04-01', [
          medication(warfarin, [[c.dateStopped, '2026-03-01']]),
          medication(aspirin, [[c.medicationInterval, coded('daily', 'Once a day')]]),
        ]),
        consultation('old', '2025-10-01', [medication(warfarin), medication(furosemide)]),
      ],
      c,
    );

    expect(past.map((one) => one.name)).toEqual(['Warfarin']);
    expect(past[0].stopped).toBe('2026-03-01');
    // Furosemide was left out of the later consultation without a stop date, so it is still active.
    expect(active.map((one) => one.name).sort()).toEqual(['Aspirin', 'Furosemide']);
    expect(active.find((one) => one.name === 'Aspirin')?.interval).toBe('Once a day');
  });

  it('lists a medicine started again after it was stopped as a second row', () => {
    const { active, past } = toMedications(
      [
        consultation('new', '2026-04-01', [medication(warfarin, [[c.dateStarted, '2026-03-15']])]),
        consultation('old', '2025-10-01', [
          medication(warfarin, [
            [c.dateStarted, '2025-06-15'],
            [c.dateStopped, '2026-01-10'],
          ]),
        ]),
      ],
      c,
    );

    expect(active).toHaveLength(1);
    expect(past).toHaveLength(1);
  });
});

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

  it('shows cardiac medications as Active and Past tables, and Add new opens the consultation form', async () => {
    serve({
      consultations: [
        consultation('new', '2026-04-01', [
          medication(aspirin, [[c.medicationDose, '75 mg']]),
          medication(warfarin, [[c.dateStopped, '2026-03-01']]),
        ]),
      ],
    });

    renderIn(<CardiacMedications patientUuid="winnie" />);

    const active = await screen.findByRole('table', { name: 'Active' });
    expect(within(active).getByText('Aspirin')).toBeInTheDocument();
    expect(within(active).getByText('75 mg')).toBeInTheDocument();
    const past = screen.getByRole('table', { name: 'Past' });
    expect(within(past).getByText('Warfarin')).toBeInTheDocument();
    expect(within(past).getByText(/Mar.*2026/)).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: /Add new/ }));
    expect(openForm).toHaveBeenCalledWith(config.consultations.form);
  });

  it('shows the medications without Add new to a user who may not record the consultation', async () => {
    serve({ consultations: [consultation('new', '2026-04-01', [medication(aspirin)])], mayEnter: false });

    renderIn(<CardiacMedications patientUuid="winnie" />);

    expect(await screen.findByRole('table', { name: 'Active' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add new/ })).not.toBeInTheDocument();
  });

  it('says there are no active medications when every one has stopped', async () => {
    serve({
      consultations: [consultation('new', '2026-04-01', [medication(warfarin, [[c.dateStopped, '2026-03-01']])])],
    });

    renderIn(<CardiacMedications patientUuid="winnie" />);

    expect(await screen.findByText('No active medications.')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Past' })).toBeInTheDocument();
  });

  it('shows every diagnosis with its priority, status and dates', async () => {
    const diagnosis = (name: string, priority: string, active: string) =>
      obs(diagnosisConcepts.group, null, [
        obs(diagnosisConcepts.category, coded(name, name)),
        obs(diagnosisConcepts.priority, coded(priority, priority)),
        obs(diagnosisConcepts.active, coded(active, active)),
        obs(diagnosisConcepts.started, '2025-02-03'),
      ]);
    serve({
      patientInformation: [
        {
          uuid: 'pi',
          encounterDatetime: '2026-03-01T09:00:00.000+0300',
          obs: [diagnosis('Rheumatic Heart Disease', 'Primary', 'Yes'), diagnosis('Congenital', 'Secondary', 'No')],
        } as ChartEncounter,
      ],
    });

    renderIn(<Diagnoses patientUuid="winnie" />);

    const rows = await screen.findAllByTestId('repeated-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent(/Rheumatic Heart Disease.*Primary.*Yes.*Feb.*2025/);
    expect(rows[1]).toHaveTextContent(/Congenital.*Secondary.*No/);
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
});
