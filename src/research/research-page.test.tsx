import React from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { openmrsFetch } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import ResearchPage from './research-page.component';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const yes = '1065AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const optInType = 'a78f6ae3-faec-5db8-9493-53877985ca7f';
const studyIdType = '7840ba5d-d927-52d6-907b-dd070bea6626';

const states = [
  { uuid: 'arc-active', name: 'Active', initial: true, terminal: false },
  { uuid: 'arc-withdrawn', name: 'Inactive - Voluntary withdrawal', initial: false, terminal: true },
];
const studies = [
  { uuid: 'arc', name: 'ARC', states },
  {
    uuid: 'miller',
    name: 'Miller',
    states: [
      { uuid: 'miller-active', name: 'Active', initial: true, terminal: false },
      { uuid: 'miller-withdrawn', name: 'Inactive - Voluntary withdrawal', initial: false, terminal: true },
    ],
  },
];
const arcEnrollment = {
  uuid: 'enrollment-arc',
  program: { uuid: 'arc' },
  dateEnrolled: '2026-09-01T00:00:00.000+0000',
  dateCompleted: null,
  attributes: [{ uuid: 'attr-1', value: 'ARC-0042', voided: false, attributeType: { uuid: studyIdType } }],
  states: [
    {
      uuid: 's1',
      startDate: '2026-09-01T00:00:00.000+0000',
      endDate: null,
      voided: false,
      state: { uuid: 'arc-active' },
    },
  ],
};
const registryEnrollment = {
  uuid: 'enrollment-registry',
  program: { uuid: 'rhd-registry' },
  dateEnrolled: '2026-01-01T00:00:00.000+0000',
  dateCompleted: null,
  attributes: [],
  states: [],
};

function backendAnswers({ optIn = yes, enrollments = [arcEnrollment, registryEnrollment] } = {}) {
  const posts: Array<{ url: string; body: unknown }> = [];
  mockOpenmrsFetch.mockImplementation(async (url: string, init?: { method?: string; body?: unknown }) => {
    if (init?.method === 'POST') {
      posts.push({ url, body: init.body });
      return { data: {} } as never;
    }
    if (url.endsWith('/actcore/studies')) {
      return { data: { results: studies } } as never;
    }
    if (url.includes('/programenrollment?patient=patient-1')) {
      return { data: { results: enrollments } } as never;
    }
    if (url.includes('/person/patient-1')) {
      return {
        data: {
          attributes: optIn
            ? [{ uuid: 'opt-in-attr', value: { uuid: optIn }, attributeType: { uuid: optInType } }]
            : [],
        },
      } as never;
    }
    throw new Error(`unexpected ${url}`);
  });
  return posts;
}

function renderPage() {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <ResearchPage patientUuid="patient-1" />
    </SWRConfig>,
  );
}

describe('Research participation', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await signInWith(['App: act.studies', 'Task: act.enterClinicalForms']);
  });

  it("lists the patient's study enrolments, and not their other programmes", async () => {
    backendAnswers();

    renderPage();

    const row = await screen.findByRole('row', { name: /ARC/ });
    expect(within(row).getByText('ARC-0042')).toBeInTheDocument();
    expect(within(row).getByText('Active')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(2);
  });

  it('enrols only after the patient answers Yes to being considered', async () => {
    backendAnswers({ optIn: null, enrollments: [] });

    renderPage();

    expect(await screen.findByText('There are no study participations to display')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add participation/ })).toBeDisabled();
    expect(screen.getByText('A patient is enrolled in a study only after answering Yes above.')).toBeInTheDocument();
  });

  it('saves the answer to being considered as the research opt-in', async () => {
    const posts = backendAnswers({ optIn: null, enrollments: [] });
    renderPage();

    await userEvent.selectOptions(await screen.findByLabelText(/considered for research/), 'Yes');

    await waitFor(() =>
      expect(posts).toContainEqual({
        url: '/ws/rest/v1/patient/patient-1',
        body: { person: { attributes: [{ attributeType: optInType, value: yes }] } },
      }),
    );
  });

  it('enrols in a study the patient is not active in, with its Study ID and first status', async () => {
    const posts = backendAnswers();
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /Add participation/ }));

    const study = screen.getByLabelText('Study');
    expect(within(study).queryByRole('option', { name: 'ARC' })).not.toBeInTheDocument();
    await userEvent.selectOptions(study, 'Miller');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Enter the Study ID')).toBeInTheDocument();
    expect(screen.getByText('Enter the enrollment date')).toBeInTheDocument();
    expect(posts).toHaveLength(0);

    await userEvent.type(screen.getByLabelText('Study ID'), 'M-7');
    fireEvent.change(screen.getByLabelText('Enrollment date'), { target: { value: '2026-10-01' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(posts).toContainEqual({
        url: '/ws/rest/v1/programenrollment',
        body: {
          patient: 'patient-1',
          program: 'miller',
          dateEnrolled: '2026-10-01',
          states: [{ state: 'miller-active', startDate: '2026-10-01' }],
          attributes: [{ attributeType: studyIdType, value: 'M-7' }],
        },
      }),
    );
  });

  it('withdraws a participant on a completion date that is not before their enrolment', async () => {
    const posts = backendAnswers();
    renderPage();
    const row = await screen.findByRole('row', { name: /ARC/ });
    await userEvent.click(within(row).getByRole('button', { name: 'Edit participation' }));

    await userEvent.selectOptions(screen.getByLabelText('Study status'), 'Inactive - Voluntary withdrawal');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Enter the completion date for an Inactive status')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Completion date'), { target: { value: '2026-08-01' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('The completion date cannot be before the enrollment date')).toBeInTheDocument();
    expect(posts).toHaveLength(0);

    fireEvent.change(screen.getByLabelText('Completion date'), { target: { value: '2026-10-10' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(posts).toContainEqual({
        url: '/ws/rest/v1/programenrollment/enrollment-arc',
        body: {
          dateEnrolled: '2026-09-01',
          dateCompleted: '2026-10-10',
          states: [{ state: 'arc-withdrawn', startDate: '2026-10-10' }],
        },
      }),
    );
  });

  it('refuses an enrollment date in the future', async () => {
    backendAnswers();
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /Add participation/ }));

    await userEvent.selectOptions(screen.getByLabelText('Study'), 'Miller');
    await userEvent.type(screen.getByLabelText('Study ID'), 'M-7');
    fireEvent.change(screen.getByLabelText('Enrollment date'), { target: { value: '2999-01-01' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('The date cannot be in the future')).toBeInTheDocument();
  });

  it('shows participation without changing it to a user who does not record clinical forms', async () => {
    await signInWith(['App: act.studies']);
    backendAnswers();

    renderPage();

    expect(await screen.findByText('ARC')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add participation/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit participation' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
  });
});
