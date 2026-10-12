import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';
import { openmrsFetch } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { consultations, encounterTypes, forms, respondWithEncounters } from '../chart.fixture';
import { useOpenFormInVisit } from '../visits/open-form-in-visit';
import ConsultationVisits from './consultations.component';

vi.mock('../visits/open-form-in-visit', () => ({ useOpenFormInVisit: vi.fn() }));
// The framework's test mock has no EmptyCard, the styleguide's empty state.
vi.mock('@openmrs/esm-framework', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  EmptyCard: ({
    displayText,
    headerTitle,
    launchForm,
  }: {
    displayText: string;
    headerTitle: string;
    launchForm?: () => void;
  }) => (
    <div data-testid="empty-card">
      {`${headerTitle}: no ${displayText}`}
      {launchForm && <button onClick={launchForm}>Record {displayText}</button>}
    </div>
  ),
}));

const openForm = vi.fn();
const clinicalForms = 'Task: act.enterClinicalForms';

// The consultation form, whose encounter type only a clinician may record.
const consultationForm = { uuid: forms.consultation, encounterType: { editPrivilege: { display: clinicalForms } } };

/** Lets the form's fetch settle, so a hidden action is hidden for its privileges and not because the form is loading. */
async function formLoaded() {
  await waitFor(() =>
    expect(openmrsFetch).toHaveBeenCalledWith(expect.stringContaining(`/form/${forms.consultation}`)),
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function renderPage() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), shouldRetryOnError: false }}>
      <ConsultationVisits patientUuid="winnie" />
    </SWRConfig>,
  );
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

describe('Consultation visits page', () => {
  beforeEach(() => {
    vi.mocked(useOpenFormInVisit).mockReturnValue({ open: openForm, isOpening: false });
    openForm.mockClear();
    vi.mocked(openmrsFetch).mockClear();
    respondWithEncounters({ consultation: consultations }, (url) =>
      url.includes(`/form/${forms.consultation}`) ? consultationForm : { results: [] },
    );
  });

  it('lists each consultation, newest first: date, seen by, NYHA class, prophylaxis plan and next review', async () => {
    await signInWith(['Add Encounters', clinicalForms]);
    renderPage();

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Date',
      'Seen by',
      'NYHA class',
      'Prophylaxis plan',
      'Next review',
    ]);
    // The first consultation's next review is six months after its encounter date.
    expect(rowTexts()).toEqual([
      ['08-Aug-2026', 'Dr Sarah Namusoke', 'II', '--', '--'],
      ['14-Oct-2025', '--', '--', 'Q28 day BPG', '14-Apr-2026'],
    ]);
  });

  it("reads only the patient's consultations", async () => {
    await signInWith(['Add Encounters', clinicalForms]);
    renderPage();

    await screen.findByRole('table');
    const searches = vi
      .mocked(openmrsFetch)
      .mock.calls.map(([url]) => String(url))
      .filter((url) => url.includes('/encounter?'));
    expect(searches.length).toBeGreaterThan(0);
    expect(searches.every((url) => url.includes('patient=winnie') && url.includes(encounterTypes.consultation))).toBe(
      true,
    );
  });

  it('offers Start consultation to a clinician, which opens the consultation form', async () => {
    await signInWith(['Add Encounters', clinicalForms]);
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /Start consultation/ }));

    expect(openForm).toHaveBeenCalledWith(forms.consultation);
  });

  it('is read-only for a community clinician, who may not record a consultation', async () => {
    await signInWith(['Add Encounters', 'Task: act.enterProphylaxis']);
    renderPage();

    expect(await screen.findByText('Dr Sarah Namusoke')).toBeInTheDocument();
    await formLoaded();
    expect(screen.queryByRole('button', { name: /Start consultation/ })).not.toBeInTheDocument();
  });

  it('says when the patient has no consultation', async () => {
    respondWithEncounters({ consultation: [] });
    await signInWith(['Add Encounters']);
    renderPage();

    expect(await screen.findByTestId('empty-card')).toHaveTextContent('Consultation visits: no consultation visits');
  });

  it('offers a community clinician no way to record one from the empty state', async () => {
    respondWithEncounters({ consultation: [] }, (url) =>
      url.includes(`/form/${forms.consultation}`) ? consultationForm : { results: [] },
    );
    await signInWith(['Add Encounters', 'Task: act.enterProphylaxis']);
    renderPage();

    await screen.findByTestId('empty-card');
    await formLoaded();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('offers a clinician the consultation form from the empty state', async () => {
    respondWithEncounters({ consultation: [] }, (url) =>
      url.includes(`/form/${forms.consultation}`) ? consultationForm : { results: [] },
    );
    await signInWith(['Add Encounters', clinicalForms]);
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Record consultation visits' }));
    expect(openForm).toHaveBeenCalledWith(forms.consultation);
  });
});
