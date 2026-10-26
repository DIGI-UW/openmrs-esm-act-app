import React from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorState, launchWorkspace2, openmrsFetch } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import ResearchPage from './research-page.component';
import { arcEnrollment, backendAnswers, closedState, no, optInType, yes } from './research.test-helper';

const mockOpenmrsFetch = vi.mocked(openmrsFetch);

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

  it('opens the enrollment workspace to add a participation for the patient', async () => {
    backendAnswers();
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /Add participation/ }));

    expect(launchWorkspace2).toHaveBeenCalledWith('act-enrollment-workspace', {
      patientUuid: 'patient-1',
      enrollmentUuid: undefined,
    });
  });

  it('opens the enrollment workspace to edit the participation of the row clicked', async () => {
    backendAnswers();
    renderPage();
    const row = await screen.findByRole('row', { name: /ARC/ });

    await userEvent.click(within(row).getByRole('button', { name: 'Edit participation' }));

    expect(launchWorkspace2).toHaveBeenCalledWith('act-enrollment-workspace', {
      patientUuid: 'patient-1',
      enrollmentUuid: 'enrollment-arc',
    });
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
