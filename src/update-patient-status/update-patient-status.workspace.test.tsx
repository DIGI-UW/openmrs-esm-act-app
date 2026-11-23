import React from 'react';
import dayjs from 'dayjs';
import useSWR, { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  getDefaultsFromConfigSchema,
  launchWorkspace2,
  openmrsFetch,
  restBaseUrl,
  showSnackbar,
  Workspace2,
} from '@openmrs/esm-framework';
import { atSessionLocation, signInWith } from '../access/sign-in.test-helper';
import { type Config, configSchema } from '../config-schema';
import UpdatePatientStatusButton from './update-patient-status-button.component';
import UpdatePatientStatusWorkspace from './update-patient-status.workspace';

const config = getDefaultsFromConfigSchema(configSchema) as Config;
const today = dayjs().format('YYYY-MM-DD');
const deathConcept = config.patientStatus.deathConcept;
const registry = config.patientStatus.programUuid;
const { concepts, encounterType, form } = config.patientStatus;
const causeUuid = (label: string) => config.patientStatus.causesOfDeath.find((one) => one.label === label)!.uuid;
const HEART_FAILURE = causeUuid('Heart failure');
const MALARIA = causeUuid('Malaria');
const woman = { dead: false, deathDate: null, birthdate: '1990-05-01T00:00:00.000+0000', gender: 'F' };
const information = [
  { uuid: 'pi-old', encounterDatetime: '2026-01-05T09:00:00.000+0000' },
  { uuid: 'pi-new', encounterDatetime: '2026-03-05T09:00:00.000+0000' },
];

const program = {
  allWorkflows: [
    {
      retired: false,
      states: [
        { uuid: 'active', terminal: false, concept: { uuid: 'c-active', display: 'Active' } },
        { uuid: 'ltfu', terminal: true, concept: { uuid: 'c-ltfu', display: 'Lost to follow-up' } },
        {
          uuid: 'reloc',
          terminal: true,
          concept: { uuid: config.patientStatus.relocationConcept, display: 'Physical relocation' },
        },
        { uuid: 'dead', terminal: true, concept: { uuid: deathConcept, display: 'Deceased' } },
      ],
    },
  ],
};
const active = {
  uuid: 'pe',
  dateEnrolled: '2026-01-10T00:00:00.000+0000',
  dateCompleted: null,
  voided: false,
  program: { uuid: registry },
  states: [],
};
const completed = {
  ...active,
  dateCompleted: '2026-08-02T00:00:00.000+0000',
  states: [
    {
      uuid: 'ps1',
      startDate: '2026-08-02T00:00:00.000+0000',
      endDate: '2026-08-02T00:00:00.000+0000',
      voided: false,
      state: { uuid: 'ltfu', concept: { uuid: 'c-ltfu', display: 'Lost to follow-up' } },
    },
  ],
};

function serve({
  enrolments = [active] as Array<object>,
  person = { dead: false, deathDate: null, birthdate: '1990-05-01T00:00:00.000+0000', gender: 'M' } as {
    dead: boolean;
    deathDate: string | null;
    birthdate?: string;
    gender?: string;
  },
  encounters = [] as Array<object>,
  failEnrolment = false,
  failPerson = false,
} = {}) {
  // An enrolment the workspace ends reads back ended, as the server would serve it.
  let served = enrolments;
  vi.mocked(openmrsFetch).mockImplementation(((url: string, init?: { method?: string }) => {
    if (init?.method === 'POST') {
      if (String(url).includes('/programenrollment/') && failEnrolment) {
        return Promise.reject(new Error('Enrolment refused'));
      }
      if (String(url).includes('/programenrollment/')) {
        served = served.map((one) => ({ ...one, dateCompleted: today }));
      }
      return String(url).includes('/person/') && failPerson
        ? Promise.reject(new Error('Death refused'))
        : Promise.resolve({ data: {} });
    }
    if (String(url).includes('/programenrollment?')) {
      return Promise.resolve({ data: { results: served } });
    }
    if (String(url).includes('/encounter?')) {
      return Promise.resolve({ data: { results: encounters, totalCount: encounters.length } });
    }
    if (String(url).includes('/program/')) {
      return Promise.resolve({ data: program });
    }
    if (String(url).includes('/person/')) {
      return Promise.resolve({ data: person });
    }
    return Promise.resolve({ data: {} });
  }) as never);
}

const posts = () =>
  vi
    .mocked(openmrsFetch)
    .mock.calls.filter(([, init]) => (init as { method?: string } | undefined)?.method === 'POST')
    .map(([url, init]) => [url, (init as { body: Record<string, unknown> }).body] as const);
const deletes = () =>
  vi
    .mocked(openmrsFetch)
    .mock.calls.filter(([, init]) => (init as { method?: string } | undefined)?.method === 'DELETE')
    .map(([url]) => String(url));

const closeWorkspace = vi.fn();
// Reads this patient and another under the framework's usePatient key; only this one should reload.
const fetchChartPatient = vi.fn(() => Promise.resolve({ resourceType: 'Patient', id: 'winnie' }));
const fetchOtherPatient = vi.fn(() => Promise.resolve({ resourceType: 'Patient', id: 'otto' }));
function ChartPatient() {
  useSWR(['patient', 'winnie'], fetchChartPatient);
  useSWR(['patient', 'otto'], fetchOtherPatient);
  return null;
}
function workspace() {
  return (
    <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
      <ChartPatient />
      <UpdatePatientStatusWorkspace
        workspaceProps={null}
        windowProps={null}
        groupProps={{ patientUuid: 'winnie' }}
        launchChildWorkspace={vi.fn()}
        closeWorkspace={closeWorkspace}
        workspaceName="act-update-patient-status-workspace"
        windowName="act-update-patient-status"
        isRootWorkspace
        showActionMenu={false}
      />
    </SWRConfig>
  );
}
async function openWorkspace() {
  render(workspace());
  await screen.findByTestId('current-status');
}
const optionNames = () => screen.getAllByRole('option').map((one) => one.textContent);

describe('UpdatePatientStatusWorkspace', () => {
  beforeEach(async () => {
    await signInWith(['Edit Patient Programs', 'Edit People']);
    closeWorkspace.mockReset();
    vi.mocked(showSnackbar).mockClear();
  });

  it("offers the workflow's terminal states to a patient in the registry, and ends the enrolment in the one chosen", async () => {
    serve();
    await openWorkspace();

    expect(screen.getByTestId('current-status')).toHaveTextContent('Active');
    expect(optionNames()).toEqual(['Choose a status', 'Lost to follow-up', 'Physical relocation', 'Deceased']);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'ltfu');
    expect(screen.getByLabelText('Date of status change')).toHaveValue(today);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(closeWorkspace).toHaveBeenCalledWith({ discardUnsavedChanges: true }));
    expect(posts()).toHaveLength(1);
    expect(posts()[0][0]).toBe(`${restBaseUrl}/programenrollment/pe`);
    expect(posts()[0][1]).toMatchObject({ states: [{ state: 'ltfu' }] });
    expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
  });

  it('ends the enrolment first, keeps the answers, then marks the person dead with the coded cause, for Deceased', async () => {
    serve();
    await openWorkspace();

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'dead');
    expect(screen.getByLabelText('Date of death')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Cause of death'), HEART_FAILURE);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(closeWorkspace).toHaveBeenCalledWith({ discardUnsavedChanges: true }));
    expect(posts().map(([url]) => url)).toEqual([
      `${restBaseUrl}/programenrollment/pe`,
      `${restBaseUrl}/encounter`,
      `${restBaseUrl}/person/winnie`,
    ]);
    expect(posts()[0][1]).toMatchObject({ states: [{ state: 'dead' }] });
    expect(posts()[2][1]).toMatchObject({ dead: true, causeOfDeath: HEART_FAILURE });
  });

  it("reloads the chart's patient after a death is saved, so the banner shows it", async () => {
    serve();
    await openWorkspace();
    expect(fetchChartPatient).toHaveBeenCalledTimes(1);

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'dead');
    await userEvent.selectOptions(screen.getByLabelText('Cause of death'), HEART_FAILURE);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(closeWorkspace).toHaveBeenCalledWith({ discardUnsavedChanges: true }));
    await waitFor(() => expect(fetchChartPatient).toHaveBeenCalledTimes(2));
    expect(fetchOtherPatient).toHaveBeenCalledTimes(1);
  });

  it('saves nothing of a death when the enrolment is refused', async () => {
    serve({ failEnrolment: true });
    await openWorkspace();
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'dead');
    await userEvent.selectOptions(screen.getByLabelText('Cause of death'), HEART_FAILURE);

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'error', title: 'The patient status could not be updated' }),
      ),
    );
    expect(posts().map(([url]) => url)).toEqual([`${restBaseUrl}/programenrollment/pe`]);
    expect(closeWorkspace).not.toHaveBeenCalled();
    expect(fetchChartPatient).toHaveBeenCalledTimes(1);
  });

  it('says the registry status was saved when the death is refused, reloads the patient, and repeats only the death', async () => {
    serve({ failPerson: true, encounters: information });
    await openWorkspace();
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'dead');
    await userEvent.clear(screen.getByLabelText('Date of death'));
    await userEvent.type(screen.getByLabelText('Date of death'), '2026-03-01');
    await userEvent.selectOptions(screen.getByLabelText('Cause of death'), HEART_FAILURE);

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'error', title: 'The registry status was saved but the death was not' }),
      ),
    );
    expect(closeWorkspace).not.toHaveBeenCalled();
    await waitFor(() => expect(fetchChartPatient).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId('current-status')).not.toHaveTextContent('Active'));
    expect(screen.getByLabelText('Status')).toBeDisabled();
    expect(screen.getByLabelText('Date of death')).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByLabelText('Cause of death')).toBeDisabled();
    await waitFor(() => expect(posts()).toHaveLength(4));
    expect(posts().map(([url]) => url)).toEqual([
      `${restBaseUrl}/programenrollment/pe`,
      `${restBaseUrl}/encounter/pi-new`,
      `${restBaseUrl}/person/winnie`,
      `${restBaseUrl}/person/winnie`,
    ]);
    expect(posts()[3][1].deathDate).toBe(posts()[0][1].dateCompleted);
    expect(posts()[3][1].deathDate).toBe(posts()[2][1].deathDate);
    expect(vi.mocked(showSnackbar).mock.calls.map(([one]) => one.title)).toEqual([
      'The registry status was saved but the death was not',
      'The registry status was saved but the death was not',
    ]);
    await waitFor(() => expect(fetchChartPatient).toHaveBeenCalledTimes(3));
  });

  it('refuses a date before the enrolment or after today', async () => {
    serve();
    await openWorkspace();
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'ltfu');
    const date = screen.getByLabelText('Date of status change');

    await userEvent.clear(date);
    await userEvent.type(date, '2025-12-31');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await userEvent.clear(date);
    await userEvent.type(date, dayjs().add(1, 'day').format('YYYY-MM-DD'));
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await userEvent.clear(date);
    await userEvent.type(date, '2026-03-01');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it("refuses a date before the Active state's start, which core refuses to end a state before", async () => {
    const startsLater = {
      ...active,
      states: [
        {
          startDate: '2026-02-01T00:00:00.000+0000',
          endDate: null,
          voided: false,
          state: { uuid: 'active', concept: { uuid: 'c-active', display: 'Active' } },
        },
      ],
    };
    serve({ enrolments: [startsLater] });
    await openWorkspace();
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'ltfu');
    const date = screen.getByLabelText('Date of status change');

    await userEvent.clear(date);
    await userEvent.type(date, '2026-01-20');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await userEvent.clear(date);
    await userEvent.type(date, '2026-02-01');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('keeps Save disabled for Deceased until a cause is chosen from the list, as core refuses a death without one', async () => {
    serve();
    await openWorkspace();
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'dead');
    const save = screen.getByRole('button', { name: 'Save' });

    expect(save).toBeDisabled();
    expect(screen.getAllByRole('option').map((one) => one.textContent)).toEqual(
      expect.arrayContaining(['Choose a cause', 'Heart failure', 'RHD - endocarditis', 'Malaria']),
    );
    await userEvent.selectOptions(screen.getByLabelText('Cause of death'), MALARIA);
    expect(save).toBeEnabled();
  });

  it('refuses a death date before the birthdate, also with no active enrolment', async () => {
    serve({ enrolments: [] });
    await openWorkspace();
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'dead');
    await userEvent.selectOptions(screen.getByLabelText('Cause of death'), MALARIA);
    const date = screen.getByLabelText('Date of death');

    await userEvent.clear(date);
    await userEvent.type(date, '1990-04-30');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await userEvent.clear(date);
    await userEvent.type(date, '1990-05-01');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('offers no status to a user who may edit people but not programmes, as the instance and global administrators', async () => {
    await signInWith(['Edit People']);
    serve();
    await openWorkspace();
    expect(screen.getByText('There is nothing to update for this patient.')).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Deceased' })).not.toBeInTheDocument();
  });

  it('offers a user who may only edit programmes the other statuses', async () => {
    await signInWith(['Edit Patient Programs']);
    serve();
    await openWorkspace();
    expect(optionNames()).toEqual(['Choose a status', 'Lost to follow-up', 'Physical relocation']);
  });

  it('offers a living patient whose enrolment ended every status and Active again; Deceased saves its answers and the person', async () => {
    serve({ enrolments: [completed] });
    await openWorkspace();

    expect(screen.getByTestId('current-status')).toHaveTextContent('Lost to follow-up');
    expect(optionNames()).toEqual([
      'Choose a status',
      'Lost to follow-up',
      'Physical relocation',
      'Deceased',
      'Active (re-enrolled)',
    ]);
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'dead');
    expect(screen.getByLabelText('Date of death')).toHaveValue(today);
    expect(screen.getByLabelText('Date of death')).toBeEnabled();
    await userEvent.selectOptions(screen.getByLabelText('Cause of death'), HEART_FAILURE);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(closeWorkspace).toHaveBeenCalledWith({ discardUnsavedChanges: true }));
    expect(posts().map(([url]) => url)).toEqual([`${restBaseUrl}/encounter`, `${restBaseUrl}/person/winnie`]);
  });

  it('dates a death as the enrolment that already ended in Deceased, and keeps that date', async () => {
    const endedDead = {
      ...completed,
      states: [
        { ...completed.states[0], state: { uuid: 'dead', concept: { uuid: deathConcept, display: 'Deceased' } } },
      ],
    };
    serve({ enrolments: [endedDead] });
    await openWorkspace();

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'dead');
    expect(screen.getByLabelText('Date of death')).toHaveValue('2026-08-02');
    expect(screen.getByLabelText('Date of death')).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText('Cause of death'), HEART_FAILURE);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(closeWorkspace).toHaveBeenCalledWith({ discardUnsavedChanges: true }));
    expect(posts().map(([url]) => url)).toEqual([`${restBaseUrl}/encounter`, `${restBaseUrl}/person/winnie`]);
    expect(String(posts()[1][1].deathDate)).toMatch(/^2026-08-02/);
  });

  it('offers a patient in no programme Deceased as a person update, as Mark patient deceased did', async () => {
    serve({ enrolments: [] });
    await openWorkspace();

    expect(screen.getByTestId('current-status')).toHaveTextContent('Not in the registry');
    expect(optionNames()).toEqual(['Choose a status', 'Deceased']);
  });

  it('ends only the enrolment, dated as the death was, for a patient already dead whose enrolment is still active', async () => {
    serve({ person: { dead: true, deathDate: '2026-07-04T00:00:00.000+0000' } });
    await openWorkspace();

    expect(screen.getByTestId('current-status')).toHaveTextContent(/Deceased/);
    expect(optionNames()).toEqual(['Choose a status', 'Deceased']);
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'dead');
    expect(screen.getByLabelText('Date of death')).toHaveValue('2026-07-04');
    expect(screen.queryByLabelText('Cause of death')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(closeWorkspace).toHaveBeenCalledWith({ discardUnsavedChanges: true }));
    expect(posts().map(([url]) => url)).toEqual([`${restBaseUrl}/programenrollment/pe`]);
  });

  it('only shows the status of a patient who is dead and out of the registry, with nothing to save', async () => {
    serve({ enrolments: [completed], person: { dead: true, deathDate: '2026-08-02T00:00:00.000+0000' } });
    await openWorkspace();

    expect(screen.getByText('There is nothing to update for this patient.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Close' }).at(-1)!);
    expect(closeWorkspace).toHaveBeenCalledWith();
  });

  it('keeps the fields, Save and Cancel together under the heading, and closes on Cancel', async () => {
    serve();
    await openWorkspace();

    expect(screen.getByRole('heading', { name: 'Update patient status' })).toBeInTheDocument();
    expect(screen.getByLabelText('Status')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(closeWorkspace).toHaveBeenCalledWith();
  });

  it('flags unsaved changes once a status is chosen, so closing the workspace asks first', async () => {
    serve();
    await openWorkspace();
    const unsaved = () => vi.mocked(Workspace2).mock.lastCall![0].hasUnsavedChanges;

    expect(unsaved()).toBe(false);
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'ltfu');
    expect(unsaved()).toBe(true);
    await userEvent.selectOptions(screen.getByLabelText('Status'), '');
    expect(unsaved()).toBe(false);
  });

  it('asks a woman who died whether she was pregnant or postpartum, and keeps Save disabled until that is answered', async () => {
    serve({ person: woman });
    await openWorkspace();
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'dead');
    await userEvent.selectOptions(screen.getByLabelText('Cause of death'), HEART_FAILURE);
    const save = screen.getByRole('button', { name: 'Save' });

    expect(save).toBeDisabled();
    await userEvent.click(screen.getByRole('radio', { name: 'No' }));
    expect(save).toBeEnabled();
  });

  it('does not ask a man who died that', async () => {
    serve();
    await openWorkspace();
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'dead');

    expect(screen.queryByText('Pregnant or postpartum at death')).not.toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Cause of death'), HEART_FAILURE);
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it("keeps a death's answers on the latest Patient Information encounter, dated with the death, between the enrolment and the death", async () => {
    serve({ person: woman, encounters: information });
    await openWorkspace();
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'dead');
    const date = screen.getByLabelText('Date of death');
    await userEvent.clear(date);
    await userEvent.type(date, '2026-06-01');
    await userEvent.selectOptions(screen.getByLabelText('Cause of death'), HEART_FAILURE);
    await userEvent.type(screen.getByLabelText('Details of death'), 'Collapsed at home');
    await userEvent.click(screen.getByRole('radio', { name: 'Yes' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(closeWorkspace).toHaveBeenCalledWith({ discardUnsavedChanges: true }));
    expect(posts().map(([url]) => url)).toEqual([
      `${restBaseUrl}/programenrollment/pe`,
      `${restBaseUrl}/encounter/pi-new`,
      `${restBaseUrl}/person/winnie`,
    ]);
    expect(posts()[1][1]).toEqual({
      obs: [
        { concept: concepts.causeOfDeath, person: 'winnie', value: HEART_FAILURE, obsDatetime: '2026-06-01' },
        { concept: concepts.detailsOfDeath, person: 'winnie', value: 'Collapsed at home', obsDatetime: '2026-06-01' },
        {
          concept: concepts.pregnantOrPostpartumAtDeath,
          person: 'winnie',
          value: concepts.yes,
          obsDatetime: '2026-06-01',
        },
      ],
    });
  });

  it('records a Patient Information encounter at the login location for the answers when the patient has none', async () => {
    serve();
    atSessionLocation('Clinic', []);
    await openWorkspace();
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'dead');
    const date = screen.getByLabelText('Date of death');
    await userEvent.clear(date);
    await userEvent.type(date, '2026-06-01');
    await userEvent.selectOptions(screen.getByLabelText('Cause of death'), MALARIA);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(closeWorkspace).toHaveBeenCalledWith({ discardUnsavedChanges: true }));
    expect(posts()[1][0]).toBe(`${restBaseUrl}/encounter`);
    expect(posts()[1][1]).toEqual({
      patient: 'winnie',
      encounterType,
      form,
      location: 'Clinic',
      encounterDatetime: '2026-06-01',
      obs: [{ concept: concepts.causeOfDeath, person: 'winnie', value: MALARIA, obsDatetime: '2026-06-01' }],
    });
  });

  it('asks where a relocated patient went, and keeps it on Patient Information after ending the enrolment', async () => {
    serve({ encounters: information });
    await openWorkspace();
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'reloc');
    expect(screen.queryByLabelText('Cause of death')).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Relocation area'), ' Gulu ');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(closeWorkspace).toHaveBeenCalledWith({ discardUnsavedChanges: true }));
    expect(posts().map(([url]) => url)).toEqual([
      `${restBaseUrl}/programenrollment/pe`,
      `${restBaseUrl}/encounter/pi-new`,
    ]);
    expect(posts()[1][1]).toEqual({
      obs: [{ concept: concepts.relocationArea, person: 'winnie', value: 'Gulu', obsDatetime: expect.any(String) }],
    });
  });

  it('saves nothing but the enrolment for a relocation with no area given', async () => {
    serve({ encounters: information });
    await openWorkspace();
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'reloc');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(closeWorkspace).toHaveBeenCalledWith({ discardUnsavedChanges: true }));
    expect(posts().map(([url]) => url)).toEqual([`${restBaseUrl}/programenrollment/pe`]);
  });

  it('says the registry status was saved but its details were not when a relocation area is refused', async () => {
    serve({ encounters: information });
    const previous = vi.mocked(openmrsFetch).getMockImplementation()!;
    vi.mocked(openmrsFetch).mockImplementation(((url: string, init?: { method?: string }) =>
      init?.method === 'POST' && String(url).includes('/encounter/')
        ? Promise.reject(new Error('Encounter refused'))
        : previous(url, init as never)) as never);
    await openWorkspace();
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'reloc');
    await userEvent.type(screen.getByLabelText('Relocation area'), 'Gulu');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'error', title: 'The registry status was saved but its details were not' }),
      ),
    );
    expect(closeWorkspace).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Status')).toBeDisabled();
  });

  it('corrects an ended enrolment: voids the state it ended in, moves the end, records the new state, and asks where a relocated patient went', async () => {
    serve({ enrolments: [completed], encounters: information });
    await openWorkspace();
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'reloc');
    const date = screen.getByLabelText('Date of status change');
    expect(date).toHaveValue(today);
    await userEvent.clear(date);
    await userEvent.type(date, '2026-01-05');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await userEvent.clear(date);
    await userEvent.type(date, '2026-08-10');
    await userEvent.type(screen.getByLabelText('Relocation area'), 'Gulu');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(closeWorkspace).toHaveBeenCalledWith({ discardUnsavedChanges: true }));
    expect(deletes()).toEqual([`${restBaseUrl}/programenrollment/pe/state/ps1`]);
    expect(posts()).toEqual([
      [`${restBaseUrl}/programenrollment/pe`, { dateCompleted: '2026-08-10' }],
      [`${restBaseUrl}/programenrollment/pe`, { states: [{ state: 'reloc', startDate: '2026-08-10' }] }],
      [
        `${restBaseUrl}/encounter/pi-new`,
        { obs: [{ concept: concepts.relocationArea, person: 'winnie', value: 'Gulu', obsDatetime: '2026-08-10' }] },
      ],
    ]);
    expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
  });

  it('enrols a returning patient again from the chosen date, which cannot be before the enrolment ended', async () => {
    serve({ enrolments: [completed] });
    atSessionLocation('Clinic', []);
    await openWorkspace();
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'reenrol');
    const date = screen.getByLabelText('Date of re-enrolment');
    await userEvent.clear(date);
    await userEvent.type(date, '2026-08-01');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await userEvent.clear(date);
    await userEvent.type(date, '2026-09-01');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(closeWorkspace).toHaveBeenCalledWith({ discardUnsavedChanges: true }));
    expect(deletes()).toEqual([]);
    expect(posts()).toEqual([
      [
        `${restBaseUrl}/programenrollment`,
        { patient: 'winnie', program: registry, dateEnrolled: '2026-09-01', location: 'Clinic' },
      ],
    ]);
  });

  it('asks no death questions when only ending the enrolment of a patient already dead', async () => {
    serve({ person: { ...woman, dead: true, deathDate: '2026-02-01T00:00:00.000+0000' } });
    await openWorkspace();
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'dead');

    expect(screen.queryByLabelText('Cause of death')).not.toBeInTheDocument();
    expect(screen.queryByText('Pregnant or postpartum at death')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(closeWorkspace).toHaveBeenCalledWith({ discardUnsavedChanges: true }));
    expect(posts().map(([url]) => url)).toEqual([`${restBaseUrl}/programenrollment/pe`]);
  });
});

describe('UpdatePatientStatusButton', () => {
  it('opens the workspace, which takes the patient from the chart, and closes the menu', async () => {
    vi.mocked(launchWorkspace2).mockClear();
    const closeMenu = vi.fn();
    render(<UpdatePatientStatusButton closeMenu={closeMenu} />);

    await userEvent.click(screen.getByRole('menuitem', { name: 'Update patient status' }));

    expect(launchWorkspace2).toHaveBeenCalledWith('act-update-patient-status-workspace');
    expect(closeMenu).toHaveBeenCalled();
  });
});
