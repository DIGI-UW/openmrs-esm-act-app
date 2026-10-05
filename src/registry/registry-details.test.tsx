import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { signInWith } from '../access/sign-in.test-helper';
import { useReportDataset } from '../reports/report-dataset.resource';
import { registryRows } from './registry.fixture';
import Registry from './registry.component';

vi.mock('../reports/report-dataset.resource', () => ({ useReportDataset: vi.fn() }));

const waitingListReport = '5b0f1c2e-9d3a-4c1b-8f6e-2a7d9e4b3c10';
const elective = 'c7fd0a5c-4a0f-5a2b-8a8b-5d9e8a0f1b23';

function reports(registry: Array<Record<string, unknown>>, waiting: Array<Record<string, unknown>> = []) {
  vi.mocked(useReportDataset).mockImplementation((report) => ({
    columns: [],
    rows: report === waitingListReport ? waiting : registry,
    isLoading: false,
    error: undefined,
    mutate: vi.fn(),
  }));
}

function shownNames() {
  return screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => row.querySelector('a').textContent);
}

const sortBy = (header: string) => userEvent.click(screen.getByRole('button', { name: new RegExp(header) }));

const rowOf = (name: string) => screen.getByRole('row', { name: new RegExp(`${name}\\b`) });

describe('Registry details, markers, sorting and search', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 3, 10), shouldAdvanceTime: true });
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    window.history.replaceState(null, '', '/openmrs/spa/home/act-registry?status=');
    await signInWith(['App: act.registry'], {
      urgencyBands: [{ label: '3: Elective (180 days)', concept: elective, deadlineDays: 180 }],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a patient's clinics, next consultation, last and next injection, and open procedures when the row is opened", async () => {
    reports(
      [
        {
          ...registryRows[0],
          primary_care_clinic: 'Anyeke HCIV',
          next_consultation_date: '2026-09-01',
          last_injection_date: '2026-09-03',
          next_due_date: '2026-10-01',
        },
      ],
      [
        {
          patient_uuid: 'patient-1',
          procedure_name: 'CT scan',
          urgency_concept: elective,
          date_added: '2026-01-01',
          recommendation_uuid: 'r1',
        },
        {
          patient_uuid: 'patient-2',
          procedure_name: 'Not theirs',
          urgency_concept: elective,
          date_added: '2026-01-01',
        },
      ],
    );
    render(<Registry />);

    expect(screen.queryByTestId('registry-cardiac-clinic')).not.toBeInTheDocument();
    await userEvent.click(within(rowOf('Patient 1')).getByRole('button', { name: 'Details' }));

    expect(screen.getByTestId('registry-cardiac-clinic')).toHaveTextContent('Lira RRH');
    expect(screen.getByTestId('registry-primary-care-clinic')).toHaveTextContent('Anyeke HCIV');
    expect(screen.getByTestId('registry-next-consultation')).toHaveTextContent('01-Sept-2026');
    expect(screen.getByTestId('registry-next-consultation')).toHaveAttribute('data-overdue', 'true');
    expect(screen.getByTestId('registry-last-injection')).toHaveTextContent('03-Sept-2026 (30 days ago)');
    expect(screen.getByTestId('registry-injection-due')).toHaveAttribute('data-overdue', 'true');
    expect(screen.getByTestId('registry-interventions')).toHaveTextContent(/^CT scan: 95 days overdue$/);
    expect(within(screen.getByTestId('registry-interventions')).getByRole('listitem')).toHaveAttribute(
      'data-overdue',
      'true',
    );
  });

  it('says None for what a patient has not got, and colours nothing overdue', async () => {
    reports([{ ...registryRows[1], primary_care_clinic: null, next_due_date: '2026-11-01' }]);
    render(<Registry />);

    await userEvent.click(within(rowOf('Patient 2')).getByRole('button', { name: 'Details' }));

    expect(screen.getByTestId('registry-primary-care-clinic')).toHaveTextContent('None');
    expect(screen.getByTestId('registry-next-consultation')).toHaveTextContent('None');
    expect(screen.getByTestId('registry-last-injection')).toHaveTextContent('None');
    expect(screen.getByTestId('registry-injection-due')).toHaveAttribute('data-overdue', 'false');
    expect(screen.queryByTestId('registry-interventions')).not.toBeInTheDocument();
  });

  it('marks a patient without recorded consent with *, and an inactive enrolment as Inactive', () => {
    reports([
      registryRows[0],
      { ...registryRows[1], consent_given: 'No' },
      { ...registryRows[2], consent_given: null },
      registryRows[3],
    ]);
    render(<Registry />);

    expect(screen.getByText('Patients marked with * have not consented to the registry')).toBeInTheDocument();
    const notConsented = (name: string) => within(rowOf(name)).queryByTitle('Not consented') !== null;
    expect(['Patient 1', 'Patient 2', 'Patient 3', 'Patient 4'].map(notConsented)).toEqual([false, true, true, false]);
    expect(within(rowOf('Patient 4')).getByText('Inactive')).toBeInTheDocument();
    expect(within(rowOf('Patient 1')).queryByText('Inactive')).not.toBeInTheDocument();
  });

  it('sorts by name, then reverses, then returns to the report order', async () => {
    reports([registryRows[2], registryRows[0], registryRows[1]]);
    render(<Registry />);

    await sortBy('Patient');
    expect(shownNames()).toEqual(['Patient 1', 'Patient 2', 'Patient 3']);
    await sortBy('Patient');
    expect(shownNames()).toEqual(['Patient 3', 'Patient 2', 'Patient 1']);
    await sortBy('Patient');
    expect(shownNames()).toEqual(['Patient 3', 'Patient 1', 'Patient 2']);
  });

  it('sorts by age, with a patient of unknown age last', async () => {
    reports([registryRows[2], { ...registryRows[0], age_years: null }, registryRows[1]]);
    render(<Registry />);

    await sortBy('Age, sex');

    expect(shownNames()).toEqual(['Patient 2', 'Patient 3', 'Patient 1']);
  });

  it('finds a patient by their alternate ID', async () => {
    reports([{ ...registryRows[0], external_id: 'ALT-77' }, registryRows[1]]);
    render(<Registry />);

    await userEvent.type(screen.getByRole('searchbox'), 'alt-77');

    expect(shownNames()).toEqual(['Patient 1']);
  });
});
