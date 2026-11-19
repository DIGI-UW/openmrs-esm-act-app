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
} = {}) {
  vi.mocked(openmrsFetch).mockImplementation(((url: string, init?: { method?: string }) => {
    if (init?.method === 'POST') {
      return String(url).includes('/programenrollment/') && failEnrolment
        ? Promise.reject(new Error('Enrolment refused'))
        : Promise.resolve({ data: {} });
    }
    if (String(url).includes('/programenrollment?')) {
      return Promise.resolve({ data: { results: enrolments } });
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

  it('marks the person dead first, with the cause, then ends the enrolment, for Deceased', async () => {
    serve();
    await openWorkspace();

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'dead');
    expect(screen.getByLabelText('Date of death')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Cause of death'), HEART_FAILURE);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(closeWorkspace).toHaveBeenCalledWith({ discardUnsavedChanges: true }));
    expect(posts().map(([url]) => url)).toEqual([
      `${restBaseUrl}/person/winnie`,
      `${restBaseUrl}/encounter`,
      `${restBaseUrl}/programenrollment/pe`,
    ]);
    expect(posts()[0][1]).toMatchObject({ dead: true, causeOfDeath: HEART_FAILURE });
    expect(posts()[2][1]).toMatchObject({ states: [{ state: 'dead' }] });
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

  it('says the death was saved when the enrolment is refused, reloads the patient, and repeats only the enrolment', async () => {
    serve({ failEnrolment: true, encounters: information });
    await openWorkspace();
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'dead');
    await userEvent.selectOptions(screen.getByLabelText('Cause of death'), HEART_FAILURE);

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'error', title: 'The death was saved but the registry status was not' }),
      ),
    );
    expect(closeWorkspace).not.toHaveBeenCalled();
    await waitFor(() => expect(fetchChartPatient).toHaveBeenCalledTimes(2));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(posts()).toHaveLength(4));
    expect(posts().map(([url]) => url)).toEqual([
      `${restBaseUrl}/person/winnie`,
      `${restBaseUrl}/encounter/pi-new`,
      `${restBaseUrl}/programenrollment/pe`,
      `${restBaseUrl}/programenrollment/pe`,
    ]);
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

  it('offers a patient with no active enrolment Deceased alone, saved as a person update only', async () => {
    serve({ enrolments: [completed] });
    await openWorkspace();

    expect(screen.getByTestId('current-status')).toHaveTextContent('Lost to follow-up');
    expect(optionNames()).toEqual(['Choose a status', 'Deceased']);
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'dead');
    await userEvent.selectOptions(screen.getByLabelText('Cause of death'), HEART_FAILURE);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(closeWorkspace).toHaveBeenCalledWith({ discardUnsavedChanges: true }));
    expect(posts().map(([url]) => url)).toEqual([`${restBaseUrl}/person/winnie`, `${restBaseUrl}/encounter`]);
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

  it("keeps a death's answers on the latest Patient Information encounter, dated with the death, before ending the enrolment", async () => {
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
      `${restBaseUrl}/person/winnie`,
      `${restBaseUrl}/encounter/pi-new`,
      `${restBaseUrl}/programenrollment/pe`,
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

  it('asks where a relocated patient went, and keeps it on Patient Information', async () => {
    serve({ encounters: information });
    await openWorkspace();
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'reloc');
    expect(screen.queryByLabelText('Cause of death')).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Relocation area'), ' Gulu ');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(closeWorkspace).toHaveBeenCalledWith({ discardUnsavedChanges: true }));
    expect(posts().map(([url]) => url)).toEqual([
      `${restBaseUrl}/encounter/pi-new`,
      `${restBaseUrl}/programenrollment/pe`,
    ]);
    expect(posts()[0][1]).toEqual({
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
