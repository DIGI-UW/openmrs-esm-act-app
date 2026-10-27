import React from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getDefaultsFromConfigSchema, openmrsFetch } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { type Config, configSchema } from '../config-schema';
import { type ChartEncounter } from '../consultations/consultations.resource';
import MedicationsCard from './medications-card.component';
import Medications from './medications.component';
import { toMedications } from './medications.resource';

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

/** A medication group as both forms save it: the group and the medicine share one concept. */
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

  it('closes a medicine when a later consultation stops it without a Date Started', () => {
    const { active, past } = toMedications(
      [
        consultation('new', '2026-04-01', [medication(warfarin, [[c.dateStopped, '2026-03-01']])]),
        consultation('old', '2025-10-01', [medication(warfarin, [[c.dateStarted, '2025-06-15']])]),
      ],
      c,
    );

    expect(active).toEqual([]);
    expect(past).toHaveLength(1);
    expect(past[0]).toMatchObject({ started: '2025-06-15', stopped: '2026-03-01' });
  });

  it('shows a stop repeated in a later consultation as one Past row', () => {
    const stop = [[c.dateStopped, '2026-01-10']] as Array<[string, unknown]>;
    const { active, past } = toMedications(
      [
        consultation('new', '2026-04-01', [medication(warfarin, stop)]),
        consultation('old', '2025-10-01', [medication(warfarin, stop)]),
      ],
      c,
    );

    expect(active).toEqual([]);
    expect(past).toHaveLength(1);
  });

  it('makes a medicine Active again, with no stop, when it is recorded after a stop', () => {
    const run = (restart: Array<[string, unknown]>) =>
      toMedications(
        [
          consultation('restart', '2026-06-01', [medication(warfarin, restart)]),
          consultation('stop', '2026-03-01', [medication(warfarin, [[c.dateStopped, '2026-02-01']])]),
          consultation('first', '2025-10-01', [medication(warfarin)]),
        ],
        c,
      );

    for (const { active, past } of [run([]), run([[c.dateStarted, '2026-05-20']])]) {
      expect(past).toEqual([]);
      expect(active).toHaveLength(1);
      expect(active[0].stopped).toBeNull();
    }
  });

  it('updates the dose when a later consultation restates a medicine and keeps the earliest start', () => {
    const { active } = toMedications(
      [
        consultation('new', '2026-04-01', [
          medication(warfarin, [
            [c.dateStarted, '2026-03-15'],
            [c.medicationDose, '5 mg'],
          ]),
        ]),
        consultation('old', '2025-10-01', [
          medication(warfarin, [
            [c.dateStarted, '2025-06-15'],
            [c.medicationDose, '3 mg'],
          ]),
        ]),
      ],
      c,
    );

    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({ started: '2025-06-15', dose: '5 mg' });
  });

  it('puts a medicine in Past for any Date Stopped, even one still to come', () => {
    const { active, past } = toMedications(
      [consultation('new', '2026-04-01', [medication(warfarin, [[c.dateStopped, '2099-01-01']])])],
      c,
    );

    expect(active).toEqual([]);
    expect(past.map((one) => one.stopped)).toEqual(['2099-01-01']);
  });

  it('starts a medicine at a later recorded Date Started rather than the consultation that first listed it', () => {
    const { active } = toMedications(
      [
        consultation('new', '2026-04-01', [medication(aspirin, [[c.dateStarted, '2026-03-01']])]),
        consultation('old', '2026-01-10', [medication(aspirin)]),
      ],
      c,
    );

    expect(active[0].started).toBe('2026-03-01');
  });

  it('keeps the previous dose and interval when the latest record leaves them blank', () => {
    const { active } = toMedications(
      [
        consultation('new', '2026-04-01', [medication(aspirin)]),
        consultation('old', '2026-01-10', [
          medication(aspirin, [
            [c.medicationDose, '75 mg'],
            [c.medicationInterval, coded('daily', 'Once a day')],
          ]),
        ]),
      ],
      c,
    );

    expect(active[0]).toMatchObject({ dose: '75 mg', interval: 'Once a day' });
  });

  it('lets the later obs win when a consultation lists the same medicine twice', () => {
    const { active, past } = toMedications(
      [
        consultation('only', '2026-04-01', [
          medication(warfarin, [
            [c.medicationDose, '3 mg'],
            [c.dateStopped, '2026-03-01'],
          ]),
          medication(warfarin, [[c.medicationDose, '5 mg']]),
        ]),
      ],
      c,
    );

    expect(past).toEqual([]);
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({ dose: '5 mg', stopped: null });
  });

  it('keeps a medicine active when a later consultation leaves it out', () => {
    const { active } = toMedications(
      [
        consultation('new', '2026-04-01', [medication(aspirin)]),
        consultation('old', '2025-10-01', [medication(warfarin)]),
      ],
      c,
    );

    expect(active.map((one) => one.name).sort()).toEqual(['Aspirin', 'Warfarin']);
  });
});

function serve({
  consultations = [] as Array<ChartEncounter>,
  updates = [] as Array<ChartEncounter>,
  mayEnter = true,
} = {}) {
  vi.mocked(openmrsFetch).mockImplementation((async (url: string) => {
    if (url.includes(`encounterType=${config.consultations.encounterType}`)) {
      return { data: { results: consultations, totalCount: consultations.length } };
    }
    if (url.includes(`encounterType=${config.medications.encounterType}`)) {
      return { data: { results: updates, totalCount: updates.length } };
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
      <Medications patientUuid="winnie" />
    </SWRConfig>,
  );

describe('the Medications page', () => {
  beforeEach(async () => {
    openForm.mockClear();
    await signInWith(['Add Encounters', 'Get Encounters', 'Get Observations', 'Task: act.enterMedications']);
  });

  it('lists active and past medicines with their dose and interval, and Add opens Medication Update', async () => {
    serve({
      consultations: [
        consultation('new', '2026-04-01', [
          medication(aspirin, [
            [c.medicationDose, '75 mg'],
            [c.medicationInterval, coded('daily', 'Once a day')],
          ]),
          medication(warfarin, [[c.dateStopped, '2026-03-01']]),
        ]),
      ],
    });

    renderPage();

    const active = await screen.findByRole('table', { name: 'Active medications' });
    expect(within(active).getAllByRole('row')[1]).toHaveTextContent(/Apr.*2026.*Aspirin · DOSE 75 mg · Once a day/);
    const past = screen.getByRole('table', { name: 'Past medications' });
    expect(within(past).getAllByRole('row')[1]).toHaveTextContent(/Warfarin.*Mar.*2026/);
    expect(within(past).getByRole('columnheader', { name: 'End date' })).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: /^Add/ }));
    expect(openForm).toHaveBeenCalledWith(config.medications.form);
  });

  it('reads Medication Update with the consultations, so one that stops a medicine moves it to Past', async () => {
    serve({
      consultations: [consultation('visit', '2026-01-10', [medication(warfarin), medication(aspirin)])],
      updates: [
        consultation('update', '2026-03-05', [
          medication(warfarin, [[c.dateStopped, '2026-03-01']]),
          medication(furosemide, [[c.dateStarted, '2025-12-01']]),
        ]),
      ],
    });

    renderPage();

    const active = await screen.findByRole('table', { name: 'Active medications' });
    expect(
      within(active)
        .getAllByRole('row')
        .slice(1)
        .map((row) => row.textContent),
    ).toEqual([expect.stringContaining('Aspirin'), expect.stringContaining('Furosemide')]);
    expect(within(screen.getByRole('table', { name: 'Past medications' })).getByText('Warfarin')).toBeInTheDocument();
  });

  it("reopens a medicine's latest record in its own form from its Edit", async () => {
    serve({
      consultations: [consultation('visit', '2026-01-10', [medication(warfarin), medication(aspirin)])],
      updates: [consultation('update', '2026-03-05', [medication(warfarin, [[c.dateStopped, '2026-03-01']])])],
    });

    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Edit Warfarin' }));
    expect(openForm).toHaveBeenLastCalledWith(config.medications.form, undefined, 'update');
    await userEvent.click(screen.getByRole('button', { name: 'Edit Aspirin' }));
    expect(openForm).toHaveBeenLastCalledWith(config.consultations.form, undefined, 'visit');
  });

  it('shows the medicines without Add or Edit to a user who may not record the forms', async () => {
    serve({ consultations: [consultation('new', '2026-04-01', [medication(aspirin)])], mayEnter: false });

    renderPage();

    expect(await screen.findByRole('table', { name: 'Active medications' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Add/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Edit/ })).not.toBeInTheDocument();
  });

  it("shows the active and past medicines on the patient summary's card", async () => {
    serve({
      consultations: [
        consultation('new', '2026-04-01', [medication(aspirin), medication(warfarin, [[c.dateStopped, '2026-03-01']])]),
      ],
    });

    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <MedicationsCard patientUuid="winnie" />
      </SWRConfig>,
    );

    const active = await screen.findByRole('table', { name: 'Active medications' });
    expect(within(active).getByText('Aspirin')).toBeInTheDocument();
    expect(within(screen.getByRole('table', { name: 'Past medications' })).getByText('Warfarin')).toBeInTheDocument();
  });

  it('says when there is nothing active or nothing past', async () => {
    serve({
      consultations: [consultation('new', '2026-04-01', [medication(warfarin, [[c.dateStopped, '2026-03-01']])])],
    });

    renderPage();

    expect(await screen.findByRole('table', { name: 'Past medications' })).toBeInTheDocument();
    expect(screen.getByText(/There are no active medications to display/)).toBeInTheDocument();
  });
});
