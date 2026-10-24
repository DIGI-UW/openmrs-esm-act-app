import React from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorState, getCoreTranslation, openmrsFetch } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { markTranslations } from '../i18n.test-helper';
import ResearchPage from './research-page.component';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

const yes = '1065AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const no = '1066AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const optInType = 'a78f6ae3-faec-5db8-9493-53877985ca7f';
const consentType = 'e15bf9b7-249e-5d75-907d-937b8d9b0c46';
const studyIdType = '7840ba5d-d927-52d6-907b-dd070bea6626';

const states = [
  { uuid: 'arc-active', name: 'Active', initial: true, terminal: false },
  { uuid: 'arc-withdrawn', name: 'Inactive - Voluntary withdrawal', initial: false, terminal: true },
  { uuid: 'arc-lost', name: 'Inactive - Lost to follow-up', initial: false, terminal: true },
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
      auditInfo: { dateCreated: '2026-09-01T09:00:00.000+0000' },
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

function backendAnswers({
  optIn = yes,
  consent = yes,
  dead = false,
  enrollments = [arcEnrollment, registryEnrollment],
  personFails = false,
  saveFails,
}: {
  optIn?: string | null;
  consent?: string | null;
  dead?: boolean;
  enrollments?: Array<unknown>;
  personFails?: boolean;
  /** The REST error body a failed save responds with. */
  saveFails?: unknown;
} = {}) {
  const posts: Array<{ url: string; body: unknown }> = [];
  mockOpenmrsFetch.mockImplementation(async (url: string, init?: { method?: string; body?: unknown }) => {
    if (init?.method === 'POST') {
      posts.push({ url, body: init.body });
      if (saveFails) {
        throw Object.assign(new Error('Server responded with 400 (Bad Request)'), { responseBody: saveFails });
      }
      return { data: {} } as never;
    }
    if (url.endsWith('/actcore/studies')) {
      return { data: { results: studies } } as never;
    }
    if (url.includes('/programenrollment?patient=patient-1')) {
      return { data: { results: enrollments } } as never;
    }
    if (url.includes('/person/patient-1')) {
      if (personFails) {
        throw new Error('person fetch failed');
      }
      return {
        data: {
          dead,
          attributes: [
            ...(optIn ? [{ uuid: 'opt-in-attr', value: { uuid: optIn }, attributeType: { uuid: optInType } }] : []),
            ...(consent
              ? [{ uuid: 'consent-attr', value: { uuid: consent }, attributeType: { uuid: consentType } }]
              : []),
          ],
        },
      } as never;
    }
    throw new Error(`unexpected ${url}`);
  });
  return posts;
}

/** A status that started and ended on the day given, as core closes the one that completes an enrolment. */
const closedState = (uuid: string, state: string, day: string, recorded = `${day}T09:00:00.000+0000`) => ({
  uuid,
  startDate: `${day}T00:00:00.000+0000`,
  endDate: `${day}T00:00:00.000+0000`,
  voided: false,
  state: { uuid: state },
  auditInfo: { dateCreated: recorded },
});

/** Matches the paragraph whose whole text this is, across the label and answer it is split into. */
const paragraph = (text: string) => (_: string, element: Element | null) =>
  element?.tagName === 'P' && element.textContent === text;

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

  it('enrols only a patient who gave registry consent, which it shows', async () => {
    backendAnswers({ consent: no, enrollments: [] });

    renderPage();

    expect(await screen.findByText('There are no study participations to display')).toBeInTheDocument();
    expect(screen.getByText(paragraph('Registry consent (recorded at registration): No'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add participation/ })).toBeDisabled();
    expect(
      screen.getByText(
        'A patient is enrolled in a study only after giving registry consent, which is recorded at registration.',
      ),
    ).toBeInTheDocument();
  });

  it('enrols no patient who has died', async () => {
    backendAnswers({ dead: true, enrollments: [] });

    renderPage();

    expect(await screen.findByText('The patient has died, so they cannot be enrolled in a study.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add participation/ })).toBeDisabled();
  });

  it('warns when a patient active in a study no longer answers Yes to research', async () => {
    backendAnswers({ optIn: no });

    renderPage();

    expect(await screen.findByText('Still active in a study')).toBeInTheDocument();
  });

  it('does not warn about a patient who has died while active in a study they consented to', async () => {
    backendAnswers({ dead: true });

    renderPage();

    expect(await screen.findByText('The patient has died, so they cannot be enrolled in a study.')).toBeInTheDocument();
    expect(screen.queryByText('Still active in a study')).not.toBeInTheDocument();
  });

  it("shows an error, not unrecorded answers, when the patient's answers cannot be loaded", async () => {
    backendAnswers({ personFails: true });

    renderPage();

    await waitFor(() =>
      expect(vi.mocked(ErrorState).mock.calls.map(([props]) => props.headerTitle)).toContain('Research participation'),
    );
    expect(screen.queryByText(/Not recorded/)).not.toBeInTheDocument();
    expect(screen.queryByText('Still active in a study')).not.toBeInTheDocument();
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

  it("offers the name of the enrolment dialog's close button to translation", async () => {
    backendAnswers();
    markTranslations();
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /Add participation/ }));

    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' })).toBeInTheDocument();
    expect(getCoreTranslation).toHaveBeenCalledWith('close');
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

  it("corrects an active participant's Study ID, keeping them Active", async () => {
    const posts = backendAnswers();
    renderPage();
    const row = await screen.findByRole('row', { name: /ARC/ });
    await userEvent.click(within(row).getByRole('button', { name: 'Edit participation' }));

    expect(screen.getByLabelText('Study status')).toHaveValue('arc-active');
    await userEvent.clear(screen.getByLabelText('Study ID'));
    await userEvent.type(screen.getByLabelText('Study ID'), 'ARC-0043');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(posts).toEqual([
        {
          url: '/ws/rest/v1/programenrollment/enrollment-arc',
          body: { dateEnrolled: '2026-09-01', dateCompleted: null },
        },
        { url: '/ws/rest/v1/programenrollment/enrollment-arc/attribute/attr-1', body: { value: 'ARC-0043' } },
      ]),
    );
  });

  it('moves the Active status to an earlier enrollment date, so a withdrawal before the old date saves', async () => {
    const posts = backendAnswers();
    renderPage();
    const row = await screen.findByRole('row', { name: /ARC/ });
    await userEvent.click(within(row).getByRole('button', { name: 'Edit participation' }));

    fireEvent.change(screen.getByLabelText('Enrollment date'), { target: { value: '2026-08-01' } });
    await userEvent.selectOptions(screen.getByLabelText('Study status'), 'Inactive - Voluntary withdrawal');
    fireEvent.change(screen.getByLabelText('Completion date'), { target: { value: '2026-08-15' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(posts).toEqual([
        { url: '/ws/rest/v1/programenrollment/enrollment-arc/state/s1', body: { startDate: '2026-08-01' } },
        {
          url: '/ws/rest/v1/programenrollment/enrollment-arc',
          body: {
            dateEnrolled: '2026-08-01',
            dateCompleted: '2026-08-15',
            states: [{ state: 'arc-withdrawn', startDate: '2026-08-15' }],
          },
        },
      ]),
    );
  });

  it('moves the Active status to a later enrollment date, so it does not start before the enrolment', async () => {
    const posts = backendAnswers();
    renderPage();
    const row = await screen.findByRole('row', { name: /ARC/ });
    await userEvent.click(within(row).getByRole('button', { name: 'Edit participation' }));

    fireEvent.change(screen.getByLabelText('Enrollment date'), { target: { value: '2026-09-20' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(posts).toEqual([
        { url: '/ws/rest/v1/programenrollment/enrollment-arc/state/s1', body: { startDate: '2026-09-20' } },
        {
          url: '/ws/rest/v1/programenrollment/enrollment-arc',
          body: { dateEnrolled: '2026-09-20', dateCompleted: null },
        },
      ]),
    );
  });

  it("says why a participation could not be saved, in the server's words for a status error", async () => {
    backendAnswers({
      saveFails: {
        error: {
          message: 'Invalid Submission',
          globalErrors: [],
          fieldErrors: { states: [{ code: 'PatientProgram.error.foundOverlappingStates', message: 'States overlap' }] },
        },
      },
    });
    renderPage();
    const row = await screen.findByRole('row', { name: /ARC/ });
    await userEvent.click(within(row).getByRole('button', { name: 'Edit participation' }));

    await userEvent.selectOptions(screen.getByLabelText('Study status'), 'Inactive - Voluntary withdrawal');
    fireEvent.change(screen.getByLabelText('Completion date'), { target: { value: '2026-10-10' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('States overlap')).toBeInTheDocument();
  });

  it('retries a save that failed partway from what was saved, not resending the withdrawal', async () => {
    const posts = backendAnswers();
    const answer = mockOpenmrsFetch.getMockImplementation();
    const withdrawn = {
      ...arcEnrollment,
      dateCompleted: '2026-10-10T00:00:00.000+0000',
      states: [
        { ...arcEnrollment.states[0], endDate: '2026-10-10T00:00:00.000+0000' },
        closedState('s2', 'arc-withdrawn', '2026-10-10'),
      ],
    };
    let attributeFails = true;
    mockOpenmrsFetch.mockImplementation(async (url: string, init?: { method?: string; body?: unknown }) => {
      if (init?.method === 'POST' && url.includes('/attribute/') && attributeFails) {
        attributeFails = false;
        posts.push({ url, body: init.body });
        throw Object.assign(new Error('Server responded with 500'), { responseBody: { error: { message: 'Down' } } });
      }
      if (!init?.method && url.includes('/programenrollment?patient=patient-1') && posts.length) {
        return { data: { results: [withdrawn] } } as never;
      }
      return answer(url, init);
    });
    renderPage();
    const row = await screen.findByRole('row', { name: /ARC/ });
    await userEvent.click(within(row).getByRole('button', { name: 'Edit participation' }));

    await userEvent.clear(screen.getByLabelText('Study ID'));
    await userEvent.type(screen.getByLabelText('Study ID'), 'ARC-0043');
    await userEvent.selectOptions(screen.getByLabelText('Study status'), 'Inactive - Voluntary withdrawal');
    fireEvent.change(screen.getByLabelText('Completion date'), { target: { value: '2026-10-10' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Down')).toBeInTheDocument();
    await waitFor(() => expect(within(row).getByText('Inactive - Voluntary withdrawal')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(posts.slice(2)).toEqual([
        {
          url: '/ws/rest/v1/programenrollment/enrollment-arc',
          body: { dateEnrolled: '2026-09-01', dateCompleted: '2026-10-10' },
        },
        { url: '/ws/rest/v1/programenrollment/enrollment-arc/attribute/attr-1', body: { value: 'ARC-0043' } },
      ]),
    );
  });

  it('offers a withdrawn participant only Inactive statuses, as rejoining is a new enrolment', async () => {
    backendAnswers({
      enrollments: [
        {
          ...arcEnrollment,
          dateCompleted: '2026-10-10T00:00:00.000+0000',
          states: [
            { ...arcEnrollment.states[0], endDate: '2026-10-10T00:00:00.000+0000' },
            {
              uuid: 's2',
              startDate: '2026-10-10T00:00:00.000+0000',
              endDate: null,
              voided: false,
              state: { uuid: 'arc-withdrawn' },
              auditInfo: { dateCreated: '2026-10-10T09:00:00.000+0000' },
            },
          ],
        },
      ],
    });
    renderPage();
    const row = await screen.findByRole('row', { name: /ARC/ });

    await userEvent.click(within(row).getByRole('button', { name: 'Edit participation' }));

    const status = screen.getByLabelText('Study status');
    expect(status).toHaveValue('arc-withdrawn');
    expect(within(status).queryByRole('option', { name: 'Active' })).not.toBeInTheDocument();
  });

  it("changes a withdrawn participant's Inactive reason in place, leaving one reason", async () => {
    const posts = backendAnswers({
      enrollments: [
        {
          ...arcEnrollment,
          dateCompleted: '2026-10-10T00:00:00.000+0000',
          states: [
            { ...arcEnrollment.states[0], endDate: '2026-10-10T00:00:00.000+0000' },
            closedState('s2', 'arc-withdrawn', '2026-10-10'),
          ],
        },
      ],
    });
    renderPage();
    const row = await screen.findByRole('row', { name: /ARC/ });
    await userEvent.click(within(row).getByRole('button', { name: 'Edit participation' }));

    await userEvent.selectOptions(screen.getByLabelText('Study status'), 'Inactive - Lost to follow-up');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(posts).toEqual([
        {
          url: '/ws/rest/v1/programenrollment/enrollment-arc',
          body: { dateEnrolled: '2026-09-01', dateCompleted: '2026-10-10' },
        },
        { url: '/ws/rest/v1/programenrollment/enrollment-arc/state/s2', body: { state: 'arc-lost' } },
      ]),
    );
  });

  it.each([false, true])(
    'shows a same-day enrolment and withdrawal as withdrawn, whatever order the states arrive in (reversed: %s)',
    async (reversed) => {
      const sameDay = [closedState('s2', 'arc-active', '2026-10-10'), closedState('s1', 'arc-withdrawn', '2026-10-10')];
      backendAnswers({
        enrollments: [
          {
            ...arcEnrollment,
            dateEnrolled: '2026-10-10T00:00:00.000+0000',
            dateCompleted: '2026-10-10T00:00:00.000+0000',
            states: reversed ? sameDay.reverse() : sameDay,
          },
        ],
      });

      renderPage();

      const row = await screen.findByRole('row', { name: /ARC/ });
      expect(within(row).getByText('Inactive - Voluntary withdrawal')).toBeInTheDocument();
    },
  );

  it.each([false, true])(
    'shows the later recorded of two same-day Inactive reasons, as the participants report does (reversed: %s)',
    async (reversed) => {
      const sameDay = [
        closedState('s3', 'arc-withdrawn', '2026-10-10', '2026-10-10T09:00:00.000+0000'),
        closedState('s2', 'arc-lost', '2026-10-10', '2026-10-11T09:00:00.000+0000'),
      ];
      backendAnswers({
        enrollments: [
          {
            ...arcEnrollment,
            dateCompleted: '2026-10-10T00:00:00.000+0000',
            states: [
              { ...arcEnrollment.states[0], endDate: '2026-10-10T00:00:00.000+0000' },
              ...(reversed ? sameDay.reverse() : sameDay),
            ],
          },
        ],
      });

      renderPage();

      const row = await screen.findByRole('row', { name: /ARC/ });
      expect(within(row).getByText('Inactive - Lost to follow-up')).toBeInTheDocument();
    },
  );

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
    expect(
      screen.getByText(paragraph('Would the patient like to be considered for research? Yes')),
    ).toBeInTheDocument();
  });
});
