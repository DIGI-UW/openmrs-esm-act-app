import React from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { openmrsFetch, showSnackbar, Workspace2 } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import EnrollmentWorkspace from './enrollment.workspace';
import { arcEnrollment, backendAnswers, closedState, studyIdType } from './research.test-helper';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);
const closeWorkspace = vi.fn();

function renderWorkspace(enrollmentUuid?: string) {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <EnrollmentWorkspace
        workspaceProps={{ patientUuid: 'patient-1', enrollmentUuid }}
        windowProps={null}
        groupProps={null}
        launchChildWorkspace={vi.fn()}
        closeWorkspace={closeWorkspace}
        workspaceName="act-enrollment-workspace"
        windowName="act-research-form"
        isRootWorkspace
        showActionMenu={false}
      />
    </SWRConfig>,
  );
}

const enrollmentLoads = () =>
  mockOpenmrsFetch.mock.calls.filter(
    ([url, init]) => !init?.method && String(url).includes('/programenrollment?patient='),
  ).length;

describe('Enrollment workspace', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await signInWith(['App: act.studies', 'Task: act.enterClinicalForms']);
  });

  it('enrols in a study the patient is not active in, with its Study ID and first status', async () => {
    const posts = backendAnswers();
    renderWorkspace();
    await screen.findByRole('option', { name: 'Miller' });

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
    renderWorkspace('enrollment-arc');
    await screen.findByLabelText('Study status');

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
    renderWorkspace('enrollment-arc');
    await screen.findByLabelText('Study status');

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
    renderWorkspace('enrollment-arc');
    await screen.findByLabelText('Study status');

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
    renderWorkspace('enrollment-arc');
    await screen.findByLabelText('Study status');

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
    renderWorkspace('enrollment-arc');
    await screen.findByLabelText('Study status');

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
    renderWorkspace('enrollment-arc');
    await screen.findByLabelText('Study status');

    await userEvent.clear(screen.getByLabelText('Study ID'));
    await userEvent.type(screen.getByLabelText('Study ID'), 'ARC-0043');
    await userEvent.selectOptions(screen.getByLabelText('Study status'), 'Inactive - Voluntary withdrawal');
    fireEvent.change(screen.getByLabelText('Completion date'), { target: { value: '2026-10-10' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Down')).toBeInTheDocument();
    await waitFor(() => expect(enrollmentLoads()).toBe(2));
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
    renderWorkspace('enrollment-arc');
    await screen.findByLabelText('Study status');

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
    renderWorkspace('enrollment-arc');
    await screen.findByLabelText('Study status');

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

  it('refuses an enrollment date in the future', async () => {
    backendAnswers();
    renderWorkspace();
    await screen.findByRole('option', { name: 'Miller' });

    await userEvent.selectOptions(screen.getByLabelText('Study'), 'Miller');
    await userEvent.type(screen.getByLabelText('Study ID'), 'M-7');
    fireEvent.change(screen.getByLabelText('Enrollment date'), { target: { value: '2999-01-01' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('The date cannot be in the future')).toBeInTheDocument();
  });

  it('closes the workspace, keeping the unsaved check off, once the participation is saved', async () => {
    backendAnswers();
    renderWorkspace();
    await screen.findByRole('option', { name: 'Miller' });

    await userEvent.selectOptions(screen.getByLabelText('Study'), 'Miller');
    await userEvent.type(screen.getByLabelText('Study ID'), 'M-7');
    fireEvent.change(screen.getByLabelText('Enrollment date'), { target: { value: '2026-10-01' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(closeWorkspace).toHaveBeenCalledWith({ discardUnsavedChanges: true }));
    expect(showSnackbar).toHaveBeenCalledWith(expect.objectContaining({ title: 'Participation saved' }));
    await waitFor(() => expect(enrollmentLoads()).toBe(2));
  });

  it('says so when the participation to edit is not among those loaded', async () => {
    backendAnswers();
    renderWorkspace('missing');

    expect(await screen.findByText('Could not load this participation')).toBeInTheDocument();
  });

  it('stays open and keeps the form when the save fails', async () => {
    backendAnswers({ saveFails: { error: { message: 'Down' } } });
    renderWorkspace('enrollment-arc');
    await screen.findByLabelText('Study status');

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Down')).toBeInTheDocument();
    expect(closeWorkspace).not.toHaveBeenCalled();
  });

  it('asks the framework to guard unsaved changes only once a field is edited, and cancels on Cancel', async () => {
    backendAnswers();
    renderWorkspace('enrollment-arc');
    await screen.findByLabelText('Study status');
    const guard = () => vi.mocked(Workspace2).mock.lastCall[0].hasUnsavedChanges;
    expect(guard()).toBe(false);

    await userEvent.type(screen.getByLabelText('Study ID'), '1');
    expect(guard()).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(closeWorkspace).toHaveBeenCalledWith();
  });

  it('offers a new participation only the studies the patient is not active in', async () => {
    backendAnswers();
    renderWorkspace();

    const study = screen.getByLabelText('Study');
    await within(study).findByRole('option', { name: 'Miller' });
    expect(within(study).queryByRole('option', { name: 'ARC' })).not.toBeInTheDocument();
  });
});
