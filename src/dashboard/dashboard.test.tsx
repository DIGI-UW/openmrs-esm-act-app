import React from 'react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { openmrsFetch, useSession } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { useReportDataset } from '../reports/report-dataset.resource';
import Dashboard from './dashboard.component';

vi.mock('../reports/report-dataset.resource', () => ({ useReportDataset: vi.fn() }));

const REGISTRY = 'f1a2b3c4-d5e6-7890-abcd-ef1234567890';
const WAITLIST = '5b0f1c2e-9d3a-4c1b-8f6e-2a7d9e4b3c10';
const OPTIMISATION = '733a512c-3243-4e91-a44a-06a8e5384606';
const CASCADE = '8b257a0c-7e96-5a01-9672-975cae3b0419';
const DIAGNOSES = '6ddf6b36-2789-4733-8433-a877d54795cf';

const registrant = (overrides: Record<string, unknown>) => ({
  enrollment_status: 'Active',
  deceased: 0,
  sex: 'F',
  age_years: 14,
  diagnosis_category: 'Rheumatic Heart Disease/Rheumatic Fever',
  diagnosis_details: 'RHD B',
  cardiac_clinic: 'Gulu RRH',
  primary_care_clinic: 'Acimi HCIII',
  ...overrides,
});

const reports: Record<string, Array<Record<string, unknown>>> = {
  [REGISTRY]: [
    registrant({}),
    registrant({ sex: 'M', age_years: 30, diagnosis_details: 'RHD A' }),
    registrant({ cardiac_clinic: 'Lira RRH', primary_care_clinic: 'Akunalaber HCIII' }),
    registrant({ enrollment_status: 'Completed', current_state: 'Inactive - Death' }),
  ],
  [WAITLIST]: [
    {
      procedure_name: 'Mitral valve repair/replacement',
      urgency: '2: urgent (60 days/2 months)',
      cardiac_clinic: 'Gulu RRH',
      primary_care_clinic: 'Acimi HCIII',
    },
    {
      procedure_name: 'Mitral valve repair/replacement',
      urgency: '1: emergent (24 hours)',
      cardiac_clinic: 'Lira RRH',
      primary_care_clinic: 'Akunalaber HCIII',
    },
  ],
  [OPTIMISATION]: [
    { measure: 'consultations', done: 12, not_done: null },
    { measure: 'echocardiogram', done: 3, not_done: 7 },
    { measure: 'warfarin', done: 1, not_done: 1 },
  ],
  [CASCADE]: [
    { step: 'Active', patients: 9 },
    { step: 'Confirmatory Diagnosis', patients: 4 },
  ],
  [DIAGNOSES]: [
    { breakdown: 'category', category: 'Rheumatic Heart Disease/Rheumatic Fever', details: null, patients: 3 },
    { breakdown: 'rhdDetails', category: 'Rheumatic Heart Disease/Rheumatic Fever', details: 'RHD A', patients: 2 },
  ],
};

/** Signs in at a location of neither clinic kind, so the dashboard opens on every clinic, with Gulu and Lira to choose. */
async function signIn() {
  await signInWith(['App: act.reports']);
  const session = vi.mocked(useSession)();
  vi.mocked(useSession).mockReturnValue({
    ...session,
    sessionLocation: { uuid: 'hq', display: 'Head office' },
  } as never);
  vi.mocked(openmrsFetch).mockImplementation(((url: string) =>
    Promise.resolve({
      data: url.includes('/location?tag=RHD%20Tertiary')
        ? {
            results: [
              { uuid: 'gulu', display: 'Gulu RRH' },
              { uuid: 'lira', display: 'Lira RRH' },
            ],
            totalCount: 2,
          }
        : url.includes('/location?tag=')
          ? { results: [], totalCount: 0 }
          : { tags: [] },
    })) as never);
  vi.mocked(useReportDataset).mockImplementation((report) => ({
    columns: [],
    rows: reports[String(report)] ?? [],
    isLoading: false,
    error: undefined,
    mutate: vi.fn(),
  }));
}

const texts = (testId: string) => screen.getAllByTestId(testId).map((element) => element.textContent);

function renderPage() {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <Dashboard />
    </SWRConfig>,
  );
}

describe('Dashboard', () => {
  beforeEach(() => vi.mocked(useReportDataset).mockReset());

  it('shows registrant status and the demographics of the active registrants of every clinic', async () => {
    await signIn();

    renderPage();

    expect(await screen.findByText('Active registrants: 3')).toBeInTheDocument();
    expect(texts('dashboard-status')).toEqual(['Active3', 'Inactive - Death1']);
    expect(texts('dashboard-sex')).toEqual(['Female2', 'Male1']);
    expect(texts('dashboard-age')).toEqual(['10-192', '20-391']);
    expect(texts('dashboard-category')).toEqual(['RHD B2', 'RHD A1']);
  });

  it('counts the waitlist by procedure and urgency, and shows medical optimisation and screening from their reports', async () => {
    await signIn();

    renderPage();

    const waitlist = (await screen.findAllByTestId('dashboard-waitlist-row'))[0];
    expect(
      within(waitlist)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['Mitral valve repair/replacement', '1', '1']);
    expect(texts('dashboard-measure')).toEqual([
      'Consultations in the last year12',
      'Echocardiogram in the last 13 months3 of 10',
      'On warfarin, with an INR in the last 90 days1 of 2',
    ]);
    expect(texts('dashboard-screening-step')).toEqual(['Active9', 'Confirmatory Diagnosis4']);
    expect(texts('dashboard-screening-category')).toEqual(['Rheumatic Heart Disease/Rheumatic Fever3']);
    expect(texts('dashboard-screening-details')).toEqual(['RHD A2']);
    expect(vi.mocked(useReportDataset)).toHaveBeenCalledWith(
      OPTIMISATION,
      expect.objectContaining({ endDate: expect.any(String) }),
    );
  });

  it('narrows every section to the clinic chosen', async () => {
    await signIn();
    renderPage();

    await userEvent.selectOptions(await screen.findByLabelText('Cardiac clinic'), 'lira');

    expect(await screen.findByText('Active registrants: 1')).toBeInTheDocument();
    expect(screen.getByText('Procedural waitlist: 1')).toBeInTheDocument();
    expect(vi.mocked(useReportDataset)).toHaveBeenLastCalledWith(
      DIAGNOSES,
      expect.objectContaining({ cardiacClinic: 'lira' }),
    );
    expect(vi.mocked(useReportDataset)).toHaveBeenCalledWith(
      OPTIMISATION,
      expect.objectContaining({ cardiacClinic: 'lira' }),
    );
  });
});
