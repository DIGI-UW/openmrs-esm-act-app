import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import { openmrsFetch } from '@openmrs/esm-framework';
import { signInWith } from './access/sign-in.test-helper';
import {
  consultations,
  forms,
  indicationOnly,
  inrReview,
  inrReviewTargetInGroup,
  respondWithEncounters,
} from './chart.fixture';
import { useOpenFormInVisit } from './visits/open-form-in-visit';
import InrCard from './inr/inr-card.component';

vi.mock('./visits/open-form-in-visit', () => ({ useOpenFormInVisit: vi.fn() }));

const openForm = vi.fn();
const clinicalForms = 'Task: act.enterClinicalForms';
const clinicianForm = (uuid: string) => ({ uuid, encounterType: { editPrivilege: { display: clinicalForms } } });
const coded = (uuid: string, display: string) => ({ uuid, display });
const obs = (concept: string, value: unknown, groupMembers: Array<object> | null = null) => ({
  concept: { uuid: concept },
  value,
  groupMembers,
});

function respond(other: Record<string, unknown> = {}) {
  respondWithEncounters({ consultation: consultations, inr: [inrReview, indicationOnly] }, (url) => {
    const match = Object.keys(other).find((key) => url.includes(key));
    if (match) {
      return other[match];
    }
    if (url.includes(`/form/${forms.inr}`)) {
      return clinicianForm(forms.inr);
    }
    return { results: [] };
  });
}

function renderIn(element: React.ReactElement) {
  return render(<SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>{element}</SWRConfig>);
}

/** Each field of a card, label and value. */
const fields = () =>
  screen.getAllByRole('term').map((term) => [term.textContent, term.nextElementSibling?.textContent]);

async function formLoaded(form: string) {
  await waitFor(() => expect(openmrsFetch).toHaveBeenCalledWith(expect.stringContaining(`/form/${form}`)));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

beforeEach(() => {
  vi.mocked(useOpenFormInVisit).mockReturnValue({ open: openForm, isOpening: false });
  vi.mocked(openmrsFetch).mockClear();
  openForm.mockClear();
  respond();
});

describe('INR review card', () => {
  it('shows the last INR, target range, next INR due and warfarin dose', async () => {
    await signInWith(['Add Encounters', clinicalForms]);
    renderIn(<InrCard patientUuid="winnie" />);

    // The INR review's new dose is newer than the consultation's 5 mg daily.
    await waitFor(() =>
      expect(fields()).toEqual([
        ['Last INR', '3.4 · 01-Sept-2026'],
        ['Target range', '2.0-3.0'],
        ['Next INR due', '01-Oct-2026'],
        ['Warfarin dose', '4 mg daily'],
      ]),
    );
  });

  it("takes the target and next INR from the latest review by its encounter's date, as the flag does", async () => {
    const review = (uuid: string, encounterDatetime: string, tested: string, target: string, next: string) => ({
      uuid,
      encounterDatetime,
      obs: [
        obs('0778ce12-ddba-5e22-b5fd-92424e8747b4', coded(target, target)),
        obs('0778ce12-ddba-5e22-b5fd-92424e8747b4', null, [
          obs('be9041b1-3948-5de0-a8b1-974e84b95715', tested),
          obs('161482AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 2.2),
        ]),
        obs('5096AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', next),
      ],
    });
    respondWithEncounters(
      {
        consultation: consultations,
        // Saved last, for a reading taken earlier.
        inr: [
          review('later-saved', '2026-09-10T10:00:00.000+0000', '2026-01-01', '1.5-2.5', '2026-11-01'),
          review('earlier-saved', '2026-08-01T10:00:00.000+0000', '2026-08-01', '2.0-3.0', '2026-09-01'),
        ],
      },
      () => ({ results: [] }),
    );
    await signInWith(['Add Encounters']);
    renderIn(<InrCard patientUuid="winnie" />);

    await waitFor(() => expect(fields()).toContainEqual(['Target range', '1.5-2.5']));
    expect(fields()).toContainEqual(['Next INR due', '01-Nov-2026']);
    expect(fields()).toContainEqual(['Last INR', '2.2 · 01-Aug-2026']);
  });

  it("shows the target range a review records inside its reading's group", async () => {
    respondWithEncounters({ consultation: consultations, inr: [inrReviewTargetInGroup] }, () => ({ results: [] }));
    await signInWith(['Add Encounters']);
    renderIn(<InrCard patientUuid="lillian" />);

    await waitFor(() => expect(fields()).toContainEqual(['Target range', '2.5-3.5']));
    expect(fields()).toContainEqual(['Last INR', '2.8 · 04-Sept-2026']);
  });

  it("shows the consultation's warfarin dose when no INR review changed it", async () => {
    respondWithEncounters({ consultation: consultations, inr: [indicationOnly] }, () => ({ results: [] }));
    await signInWith(['Add Encounters']);
    renderIn(<InrCard patientUuid="winnie" />);

    await waitFor(() => expect(fields()).toContainEqual(['Warfarin dose', '5 mg daily']));
    expect(fields()).toContainEqual(['Last INR', '--']);
  });

  it('is not shown for a patient not on warfarin', async () => {
    respondWithEncounters({ consultation: [consultations[0]], inr: [inrReview] }, () => ({ results: [] }));
    await signInWith(['Add Encounters']);
    const { container } = renderIn(<InrCard patientUuid="winnie" />);

    await waitFor(() => expect(openmrsFetch).toHaveBeenCalled());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container).toBeEmptyDOMElement();
  });

  it('offers Record INR to a clinician, and not to a community clinician', async () => {
    await signInWith(['Add Encounters', clinicalForms]);
    const { unmount } = renderIn(<InrCard patientUuid="winnie" />);
    await userEvent.click(await screen.findByRole('button', { name: /Record INR/ }));
    expect(openForm).toHaveBeenCalledWith(forms.inr);
    unmount();

    await signInWith(['Add Encounters', 'Task: act.enterProphylaxis']);
    renderIn(<InrCard patientUuid="winnie" />);
    await formLoaded(forms.inr);
    await screen.findByText('Last INR');
    expect(screen.queryByRole('button', { name: /Record INR/ })).not.toBeInTheDocument();
  });
});
