import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import { openmrsFetch, usePatient } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import {
  concepts,
  consultations,
  forms,
  indicationOnly,
  inrReview,
  inrReviewTargetInGroup,
  medication,
  respondWithEncounters,
} from '../chart.fixture';
import { useOpenFormInVisit } from '../visits/open-form-in-visit';
import InrReviews from './inr-reviews.component';
import InrReviewsDashboardLink from './inr-reviews-dashboard-link.component';
import { inrResult } from './inr.resource';

vi.mock('../visits/open-form-in-visit', () => ({ useOpenFormInVisit: vi.fn() }));
vi.mock('@openmrs/esm-framework', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  EmptyCard: ({ displayText, headerTitle }: { displayText: string; headerTitle: string }) => (
    <div data-testid="empty-card">{`${headerTitle}: no ${displayText}`}</div>
  ),
}));
// The chart's own dashboard link, which createDashboard returns, as a plain link to the page's path.
vi.mock('../chart-nav/chart-dashboard-link', () => ({
  ChartDashboardLink: ({ title }: { title: string }) => <a href="#inr">{title}</a>,
}));

const openForm = vi.fn();
const clinicalForms = 'Task: act.enterClinicalForms';
const inrForm = { uuid: forms.inr, encounterType: { editPrivilege: { display: clinicalForms } } };
const answer = (uuid: string, display: string) => ({ uuid, display });

function renderIn(element: React.ReactElement) {
  return render(<SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>{element}</SWRConfig>);
}

const rowTexts = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .map((row) =>
      within(row)
        .queryAllByRole('cell')
        .map((cell) => cell.textContent),
    )
    .filter((cells) => cells.length);

describe('INR reviews page', () => {
  beforeEach(() => {
    vi.mocked(useOpenFormInVisit).mockReturnValue({ open: openForm, isOpening: false });
    vi.mocked(openmrsFetch).mockClear();
    openForm.mockClear();
    respondWithEncounters({ inr: [inrReview, indicationOnly] }, (url) =>
      url.includes(`/form/${forms.inr}`) ? inrForm : { results: [] },
    );
  });

  it('lists each reading, newest first, with its target range, result and next INR', async () => {
    await signInWith(['Add Encounters', clinicalForms]);
    renderIn(<InrReviews patientUuid="winnie" />);

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Date',
      'INR',
      'Target range',
      'Result',
      'Next INR',
    ]);
    // A review with only an indication is still a row, so a review saved without its reading shows.
    expect(rowTexts()).toEqual([
      ['01-Sept-2026', '3.4', '2.0-3.0', 'Above range', '01-Oct-2026'],
      ['30-Aug-2026', '--', '--', '--', '--'],
      ['20-Aug-2026', '1.8', '2.0-3.0', 'Below range', '01-Oct-2026'],
    ]);
  });

  it("reads a reading's target from its own group when the target is recorded there", async () => {
    respondWithEncounters({ inr: [inrReviewTargetInGroup] }, (url) =>
      url.includes(`/form/${forms.inr}`) ? inrForm : { results: [] },
    );
    await signInWith(['Add Encounters', clinicalForms]);
    renderIn(<InrReviews patientUuid="lillian" />);

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(rowTexts()).toEqual([['04-Sept-2026', '2.8', '2.5-3.5', 'In range', '04-Oct-2026']]);
  });

  it('offers Record INR to a clinician, which opens the INR form', async () => {
    await signInWith(['Add Encounters', clinicalForms]);
    renderIn(<InrReviews patientUuid="winnie" />);

    await userEvent.click(await screen.findByRole('button', { name: /Record INR/ }));

    expect(openForm).toHaveBeenCalledWith(forms.inr);
  });

  it('is read-only for a community clinician', async () => {
    await signInWith(['Add Encounters', 'Task: act.enterProphylaxis']);
    renderIn(<InrReviews patientUuid="winnie" />);

    await screen.findByRole('table');
    await waitFor(() => expect(openmrsFetch).toHaveBeenCalledWith(expect.stringContaining(`/form/${forms.inr}`)));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.queryByRole('button', { name: /Record INR/ })).not.toBeInTheDocument();
  });
});

describe('inrResult', () => {
  it.each([
    [2.0, 'inRange'],
    [3.0, 'inRange'],
    [1.9, 'below'],
    [3.1, 'above'],
  ] as const)('reads an INR of %s against 2.0-3.0 as %s, the range taking in both its ends', (inr, result) => {
    expect(inrResult(inr, '2.0-3.0')).toBe(result);
  });

  it.each([
    [null, '2.0-3.0'],
    [2.5, null],
    [2.5, 'Other'],
  ])('reads nothing when the INR (%s) or a range (%s) is missing', (inr, target) => {
    expect(inrResult(inr, target)).toBeNull();
  });
});

describe('INR reviews link', () => {
  beforeEach(async () => {
    await signInWith(['Get Encounters', 'Get Observations']);
    vi.mocked(usePatient).mockReturnValue({ patientUuid: 'winnie', isLoading: false } as never);
  });

  it('shows for a patient on warfarin', async () => {
    respondWithEncounters({ consultation: consultations });
    renderIn(<InrReviewsDashboardLink basePath="/patient/winnie/chart" />);

    expect(await screen.findByRole('link', { name: 'INR reviews' })).toBeInTheDocument();
  });

  it('shows for a patient on Acitrom, which is warfarin too', async () => {
    const acitrom = {
      ...consultations[1],
      obs: [medication(answer('3c7f8916-3ab5-5678-83c5-be7c7bb1f5e7', 'Acitrom'))],
    };
    respondWithEncounters({ consultation: [consultations[0], acitrom] });
    renderIn(<InrReviewsDashboardLink basePath="/patient/winnie/chart" />);

    expect(await screen.findByRole('link', { name: 'INR reviews' })).toBeInTheDocument();
  });

  it.each([
    [
      'whose warfarin was stopped',
      [
        medication(answer('5e97fe35-58df-4925-bba7-7c49d75268a1', 'Warfarin'), [
          { concept: { uuid: concepts.stopped }, value: '2026-09-01', groupMembers: null },
        ]),
      ],
    ],
    [
      'whose latest medication list has no warfarin',
      [medication(answer('71617AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'Aspirin'))],
    ],
    ['with no cardiac medication', []],
  ])('is hidden for a patient %s', async (_, obs) => {
    const latest = { ...consultations[1], encounterDatetime: '2026-09-10T06:00:00.000+0000', uuid: 'latest', obs };
    respondWithEncounters({ consultation: obs.length ? [...consultations, latest] : [consultations[0]] });
    const { container } = renderIn(<InrReviewsDashboardLink basePath="/patient/winnie/chart" />);

    await waitFor(() => expect(openmrsFetch).toHaveBeenCalled());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container).toBeEmptyDOMElement();
  });
});
