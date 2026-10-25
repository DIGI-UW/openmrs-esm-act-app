import React from 'react';
import dayjs from 'dayjs';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  getDefaultsFromConfigSchema,
  openmrsFetch,
  restBaseUrl,
  showModal,
  showSnackbar,
} from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { type Config, configSchema } from '../config-schema';
import UpdatePatientStatusButton from './update-patient-status-button.component';
import UpdatePatientStatusModal from './update-patient-status-modal.component';

const config = getDefaultsFromConfigSchema(configSchema) as Config;
const today = dayjs().format('YYYY-MM-DD');
const deathConcept = config.patientStatus.deathConcept;
const registry = config.patientStatus.programUuid;

const program = {
  allWorkflows: [
    {
      retired: false,
      states: [
        { uuid: 'active', terminal: false, concept: { uuid: 'c-active', display: 'Active' } },
        { uuid: 'ltfu', terminal: true, concept: { uuid: 'c-ltfu', display: 'Lost to follow-up' } },
        { uuid: 'reloc', terminal: true, concept: { uuid: 'c-reloc', display: 'Physical relocation' } },
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
  person = { dead: false, deathDate: null } as { dead: boolean; deathDate: string | null },
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

const closeModal = vi.fn();
async function openModal() {
  render(
    <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
      <UpdatePatientStatusModal closeModal={closeModal} patientUuid="winnie" />
    </SWRConfig>,
  );
  await screen.findByTestId('current-status');
}
const optionNames = () => screen.getAllByRole('option').map((one) => one.textContent);

describe('UpdatePatientStatusModal', () => {
  beforeEach(async () => {
    await signInWith(['Edit Patient Programs', 'Edit People']);
    closeModal.mockReset();
    vi.mocked(showSnackbar).mockClear();
  });

  it("offers the workflow's terminal states to a patient in the registry, and ends the enrolment in the one chosen", async () => {
    serve();
    await openModal();

    expect(screen.getByTestId('current-status')).toHaveTextContent('Active');
    expect(optionNames()).toEqual(['Choose a status', 'Lost to follow-up', 'Physical relocation', 'Deceased']);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'ltfu');
    expect(screen.getByLabelText('Date of status change')).toHaveValue(today);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(closeModal).toHaveBeenCalled());
    expect(posts()).toHaveLength(1);
    expect(posts()[0][0]).toBe(`${restBaseUrl}/programenrollment/pe`);
    expect(posts()[0][1]).toMatchObject({ states: [{ state: 'ltfu' }] });
    expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ kind: 'success' }));
  });

  it('marks the person dead first, with the cause, then ends the enrolment, for Deceased', async () => {
    serve();
    await openModal();

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'dead');
    expect(screen.getByLabelText('Date of death')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Cause of death (optional)'), 'Heart failure');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(closeModal).toHaveBeenCalled());
    expect(posts().map(([url]) => url)).toEqual([
      `${restBaseUrl}/person/winnie`,
      `${restBaseUrl}/programenrollment/pe`,
    ]);
    expect(posts()[0][1]).toMatchObject({ dead: true, causeOfDeathNonCoded: 'Heart failure' });
    expect(posts()[1][1]).toMatchObject({ states: [{ state: 'dead' }] });
  });

  it('says the death was saved when the enrolment is refused, and a second Save repeats only the enrolment', async () => {
    serve({ failEnrolment: true });
    await openModal();
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'dead');

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(showSnackbar).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'error', title: 'The death was saved but the registry status was not' }),
      ),
    );
    expect(closeModal).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(posts()).toHaveLength(3));
    expect(posts().map(([url]) => url)).toEqual([
      `${restBaseUrl}/person/winnie`,
      `${restBaseUrl}/programenrollment/pe`,
      `${restBaseUrl}/programenrollment/pe`,
    ]);
  });

  it('refuses a date before the enrolment or after today', async () => {
    serve();
    await openModal();
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

  it('offers a user who may only edit people Deceased alone', async () => {
    await signInWith(['Edit People']);
    serve();
    await openModal();
    expect(optionNames()).toEqual(['Choose a status', 'Deceased']);
  });

  it('offers a user who may only edit programmes the other statuses', async () => {
    await signInWith(['Edit Patient Programs']);
    serve();
    await openModal();
    expect(optionNames()).toEqual(['Choose a status', 'Lost to follow-up', 'Physical relocation']);
  });

  it('offers a patient with no active enrolment Deceased alone, saved as a person update only', async () => {
    serve({ enrolments: [completed] });
    await openModal();

    expect(screen.getByTestId('current-status')).toHaveTextContent('Lost to follow-up');
    expect(optionNames()).toEqual(['Choose a status', 'Deceased']);
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'dead');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(closeModal).toHaveBeenCalled());
    expect(posts().map(([url]) => url)).toEqual([`${restBaseUrl}/person/winnie`]);
  });

  it('offers a patient in no programme Deceased as a person update, as Mark patient deceased did', async () => {
    serve({ enrolments: [] });
    await openModal();

    expect(screen.getByTestId('current-status')).toHaveTextContent('Not in the registry');
    expect(optionNames()).toEqual(['Choose a status', 'Deceased']);
  });

  it('ends only the enrolment, dated as the death was, for a patient already dead whose enrolment is still active', async () => {
    serve({ person: { dead: true, deathDate: '2026-07-04T00:00:00.000+0000' } });
    await openModal();

    expect(screen.getByTestId('current-status')).toHaveTextContent(/Deceased/);
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'dead');
    expect(screen.getByLabelText('Date of death')).toHaveValue('2026-07-04');
    expect(screen.queryByLabelText('Cause of death (optional)')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(closeModal).toHaveBeenCalled());
    expect(posts().map(([url]) => url)).toEqual([`${restBaseUrl}/programenrollment/pe`]);
  });

  it('only shows the status of a patient who is dead and out of the registry, with nothing to save', async () => {
    serve({ enrolments: [completed], person: { dead: true, deathDate: '2026-08-02T00:00:00.000+0000' } });
    await openModal();

    expect(screen.getByText('There is nothing to update for this patient.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });
});

describe('UpdatePatientStatusButton', () => {
  it('opens the dialog for the patient through the modal system, and closes the menu', async () => {
    const dispose = vi.fn();
    vi.mocked(showModal).mockReset().mockReturnValue(dispose);
    render(<UpdatePatientStatusButton patientUuid="winnie" />);

    await userEvent.click(screen.getByRole('menuitem', { name: 'Update patient status' }));

    expect(showModal).toHaveBeenCalledWith(
      'update-patient-status-modal',
      expect.objectContaining({ patientUuid: 'winnie', closeModal: expect.any(Function) }),
    );
    (vi.mocked(showModal).mock.calls[0][1] as { closeModal: () => void }).closeModal();
    expect(dispose).toHaveBeenCalled();
  });
});
