import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import { openmrsFetch } from '@openmrs/esm-framework';
import { signInWith } from './access/sign-in.test-helper';
import { consultations, forms, indicationOnly, inrReview, respondWithEncounters } from './chart.fixture';
import { useOpenFormInVisit } from './visits/open-form-in-visit';
import ConsultationCard from './consultations/consultation-card.component';
import InrCard from './inr/inr-card.component';
import ContactCard from './contact/contact-card.component';

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

// Winnie Auma's Patient Information on the seeded distro: an active primary RHD diagnosis with its details.
const patientInformation = {
  uuid: 'info',
  encounterDatetime: '2025-10-14T11:00:00.000+0000',
  obs: [
    obs('594b4495-36dc-52a6-9810-15a9e2e2dcb9', null, [
      obs('97c025b2-f42c-5c53-8aaa-0506c8dd3774', coded('deba7fd3-1780-5b23-b702-76140a161169', 'Primary Diagnosis')),
      obs('cfe17bb5-4a76-5f3a-9e1c-7b1e9b84a8e3', coded('8c2f337a-99b3-5f76-8312-1cee4336309c', 'RHD C/RHD D')),
      obs('b1b5d279-8013-5ae4-83a7-0f2bd9bc8457', coded('cf82933b-3f3f-45e7-a5ab-5d31aaee3da3', 'True')),
      obs(
        '1a5aa050-661d-5e89-95d7-c1eba476df22',
        coded('4e529463-2036-5327-ad69-7cbd39df86a1', 'Rheumatic Heart Disease/Rheumatic Fever'),
      ),
    ]),
  ],
};

const location = (uuid: string, display: string) => ({ uuid, display });
const kitgum = location('f8cf700a-2e5d-594e-86e0-061fedae2c6d', 'Kitgum General Hospital');

// Winnie's person on the seeded distro, with the phone and village registration records added.
const person = {
  attributes: [
    {
      attributeType: { uuid: '8d87236c-c2cc-11de-8d13-0010c6dffd0f' },
      value: location('akunalaber', 'Akunalaber HCIII'),
    },
    { attributeType: { uuid: 'fe261119-2911-5b36-be40-8f9827826987' }, value: kitgum },
    { attributeType: { uuid: '542c6fd2-05ca-53e3-a4f5-cd23bc1abd8f' }, value: '0772 123456' },
    { attributeType: { uuid: 'ea3cb7ae-ffbe-5aee-8343-44977898f675' }, value: 'Mary Auma' },
  ],
  preferredAddress: { cityVillage: 'Aloi' },
};

// Kitgum is a district clinic under the tertiary centre, as the distro's locations CSV places it.
const kitgumPlace = {
  display: 'Kitgum General Hospital',
  tags: [{ display: 'RHD District' }],
  parentLocation: {
    display: 'Uganda Heart Institute Tertiary',
    tags: [{ display: 'RHD Tertiary' }],
    parentLocation: null,
  },
};

function respond(other: Record<string, unknown> = {}) {
  respondWithEncounters(
    { consultation: consultations, inr: [inrReview, indicationOnly], patientInformation: [patientInformation] },
    (url) => {
      const match = Object.keys(other).find((key) => url.includes(key));
      if (match) {
        return other[match];
      }
      if (url.includes(`/form/${forms.consultation}`)) {
        return clinicianForm(forms.consultation);
      }
      if (url.includes(`/form/${forms.inr}`)) {
        return clinicianForm(forms.inr);
      }
      if (url.includes('/person/winnie')) {
        return person;
      }
      if (url.includes(`/location/${kitgum.uuid}`)) {
        return kitgumPlace;
      }
      return { results: [] };
    },
  );
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

describe('Consultation visits card', () => {
  it('shows the last consultation, next cardiology review, diagnosis and cardiac clinic', async () => {
    await signInWith(['Add Encounters', clinicalForms]);
    renderIn(<ConsultationCard patientUuid="winnie" />);

    await waitFor(() =>
      expect(fields()).toEqual([
        ['Last consultation', '08-Aug-2026'],
        // From the latest consultation that sets one, the first, six months after its date.
        ['Next cardiology review', '14-Apr-2026'],
        ['Diagnosis', 'RHD C/RHD D'],
        ['Cardiac clinic', 'Kitgum General Hospital'],
      ]),
    );
  });

  it('shows its other fields when the cardiac clinic cannot be read', async () => {
    respond({ '/person/winnie': new Error('Privilege required: Get People') });
    await signInWith(['Add Encounters']);
    renderIn(<ConsultationCard patientUuid="winnie" />);

    await waitFor(() => expect(fields()).toContainEqual(['Cardiac clinic', '--']));
    expect(fields()).toContainEqual(['Last consultation', '08-Aug-2026']);
  });

  it("takes the next review from the latest consultation by its encounter's date, as the flag does, not by the date the form records", async () => {
    const months = { uuid: '1074AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', display: 'Months' };
    const consultation = (uuid: string, encounterDatetime: string, formDate: string, amount: number) => ({
      uuid,
      encounterDatetime,
      encounterProviders: [],
      obs: [
        obs('c3edefd2-5777-5084-b01e-fd4ca0e40162', formDate),
        obs('ba4b8a87-2ce8-559e-9a30-45504a9b6c1f', amount),
        obs('1732AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', months),
      ],
    });
    respondWithEncounters(
      {
        // Saved last, for a visit the form dates earlier.
        consultation: [
          consultation('later-saved', '2026-09-01T10:00:00.000+0000', '2025-01-01', 1),
          consultation('earlier-saved', '2026-01-01T10:00:00.000+0000', '2026-02-01', 2),
        ],
      },
      () => ({ results: [] }),
    );
    await signInWith(['Add Encounters']);
    renderIn(<ConsultationCard patientUuid="winnie" />);

    await waitFor(() => expect(fields()).toContainEqual(['Next cardiology review', '01-Oct-2026']));
  });

  it("shows the diagnosis's category when it has no details", async () => {
    const [group] = patientInformation.obs;
    const categoryOnly = {
      ...patientInformation,
      obs: [
        {
          ...group,
          groupMembers: (group.groupMembers as Array<{ concept: { uuid: string } }>).filter(
            (member) => !member.concept.uuid.startsWith('cfe17bb5'),
          ),
        },
      ],
    };
    respondWithEncounters({ patientInformation: [categoryOnly] }, () => ({ results: [] }));
    await signInWith(['Add Encounters']);
    renderIn(<ConsultationCard patientUuid="winnie" />);

    await waitFor(() => expect(fields()).toContainEqual(['Diagnosis', 'Rheumatic Heart Disease/Rheumatic Fever']));
  });

  it('offers Start consultation to a clinician', async () => {
    await signInWith(['Add Encounters', clinicalForms]);
    renderIn(<ConsultationCard patientUuid="winnie" />);

    await userEvent.click(await screen.findByRole('button', { name: /Start consultation/ }));

    expect(openForm).toHaveBeenCalledWith(forms.consultation);
  });

  it('offers a community clinician no Start consultation', async () => {
    await signInWith(['Add Encounters', 'Task: act.enterProphylaxis']);
    renderIn(<ConsultationCard patientUuid="winnie" />);

    await formLoaded(forms.consultation);
    await waitFor(() => expect(fields()[0]).toEqual(['Last consultation', '08-Aug-2026']));
    expect(screen.queryByRole('button', { name: /Start consultation/ })).not.toBeInTheDocument();
  });
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

describe('Contact card', () => {
  it('shows the phone, its owner, village, clinics and the tertiary care centre above the cardiac clinic', async () => {
    await signInWith(['Get People']);
    renderIn(<ContactCard patientUuid="winnie" />);

    await waitFor(() =>
      expect(fields()).toEqual([
        ['Phone', '0772 123456'],
        ['Phone owner', 'Mary Auma'],
        ['Village', 'Aloi'],
        // Winnie's primary care clinic is in Health Center, as patients seeded before registration recorded it.
        ['Primary care clinic', 'Akunalaber HCIII'],
        ['Cardiac clinic', 'Kitgum General Hospital'],
        ['Tertiary care centre', 'Uganda Heart Institute Tertiary'],
      ]),
    );
  });

  it('prefers the Primary Care Clinic registration records, and says -- for what is not recorded', async () => {
    respond({
      '/person/winnie': {
        attributes: [
          ...person.attributes.filter((attribute) => !attribute.attributeType.uuid.startsWith('542c6fd2')),
          { attributeType: { uuid: '695f2990-236f-5d7c-b8aa-ddbdb22400f4' }, value: location('acimi', 'Acimi HCIII') },
        ],
        preferredAddress: null,
      },
    });
    await signInWith(['Get People']);
    renderIn(<ContactCard patientUuid="winnie" />);

    await waitFor(() => expect(fields()).toContainEqual(['Primary care clinic', 'Acimi HCIII']));
    expect(fields()).toContainEqual(['Phone', '--']);
    expect(fields()).toContainEqual(['Village', '--']);
  });

  it('names a tertiary cardiac clinic as its own tertiary care centre', async () => {
    respond({
      [`/location/${kitgum.uuid}`]: {
        display: 'Kitgum General Hospital',
        tags: [{ display: 'RHD Tertiary' }],
        parentLocation: null,
      },
    });
    await signInWith(['Get People']);
    renderIn(<ContactCard patientUuid="winnie" />);

    await waitFor(() => expect(fields()).toContainEqual(['Tertiary care centre', 'Kitgum General Hospital']));
  });
});
