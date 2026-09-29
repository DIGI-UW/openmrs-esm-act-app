import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { navigate } from '@openmrs/esm-framework';
import { signInWith } from '../access/sign-in.test-helper';
import { useReportDataset } from '../reports/report-dataset.resource';
import { registryRows } from './registry.fixture';
import Registry from './registry.component';

vi.mock('../reports/report-dataset.resource', () => ({ useReportDataset: vi.fn() }));
const mockUseReportDataset = vi.mocked(useReportDataset);

function dataset(value: Partial<ReturnType<typeof useReportDataset>>) {
  mockUseReportDataset.mockReturnValue({ columns: [], rows: [], isLoading: false, error: undefined, ...value });
}

const registryPrivilege = 'View Patient Flags';

describe('Registry', () => {
  beforeEach(async () => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    await signInWith([registryPrivilege]);
  });

  it("lists the report's patients with their name, ACT ID, age, sex, diagnosis, regimen and next consultation", () => {
    dataset({ rows: registryRows });

    render(<Registry />);

    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent);
    expect(headers).toEqual([
      'Name',
      'ACT ID',
      'Age',
      'Sex',
      'Diagnosis category',
      'Prophylaxis regimen',
      'Next consultation',
      'Flags',
    ]);
    const first = screen.getByRole('row', { name: /Patient 1\b/ });
    expect(
      within(first)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['Patient 1', 'rhd00001', '10', 'F', 'RHD A', 'Q28 day BPG', '15-Oct-2026', '']);
  });

  it('evaluates the configured report over every enrolment up to today', () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 29, 10) });
    dataset({ rows: registryRows });

    render(<Registry />);

    vi.useRealTimers();
    expect(mockUseReportDataset).toHaveBeenLastCalledWith('f1a2b3c4-d5e6-7890-abcd-ef1234567890', {
      startDate: '1900-01-01',
      endDate: '2026-09-29',
    });
  });

  it('shows the patients a page at a time', async () => {
    dataset({ rows: registryRows });

    render(<Registry />);

    expect(screen.getAllByRole('row')).toHaveLength(1 + 25);
    await userEvent.click(screen.getByRole('button', { name: /next page/i }));
    expect(screen.getAllByRole('row')).toHaveLength(1 + 5);
    expect(screen.getByRole('row', { name: /Patient 30\b/ })).toBeInTheDocument();
  });

  it("opens a patient's chart from their row", async () => {
    dataset({ rows: registryRows });

    render(<Registry />);

    await userEvent.click(screen.getByRole('row', { name: /Patient 2\b/ }));
    expect(vi.mocked(navigate)).toHaveBeenCalledWith({ to: '${openmrsSpaBase}/patient/patient-2/chart' });
  });

  it('offers larger pages, and shows as many rows as the page size chosen', async () => {
    dataset({ rows: registryRows });

    render(<Registry />);

    await userEvent.selectOptions(screen.getByLabelText(/items per page/i), '50');
    expect(screen.getAllByRole('row')).toHaveLength(1 + 30);
  });

  it("opens a patient's chart once when their name is clicked", async () => {
    dataset({ rows: registryRows });

    render(<Registry />);

    await userEvent.click(screen.getByRole('link', { name: 'Patient 2' }));
    expect(vi.mocked(navigate)).toHaveBeenCalledTimes(0);
  });

  it("links each patient's name to their chart, for keyboard and new-tab use", () => {
    dataset({ rows: registryRows });

    render(<Registry />);

    expect(screen.getByRole('link', { name: 'Patient 2' })).toHaveAttribute(
      'href',
      '/openmrs/spa/patient/patient-2/chart',
    );
  });

  it('says so when no patient is enrolled', () => {
    dataset({ rows: [] });

    render(<Registry />);

    expect(screen.getByText('No patients are enrolled in the registry.')).toBeInTheDocument();
  });

  it('says so when the report cannot be loaded', () => {
    dataset({ error: new Error('Server responded with 404') });

    render(<Registry />);

    expect(screen.getByText('Could not load the registry')).toBeInTheDocument();
  });

  it('shows a placeholder while the report runs', () => {
    dataset({ isLoading: true });

    render(<Registry />);

    expect(screen.getByTestId('registry-loading')).toBeInTheDocument();
  });

  it('tells a user without the registry privilege that they cannot see it', async () => {
    await signInWith(['Get Patients'], {
      screenPrivileges: { home: 'x', registry: 'App: act.registry', waitingList: 'x', screenPositive: 'x' },
    });
    dataset({ rows: registryRows });

    render(<Registry />);

    expect(screen.getByText('You do not have access to the registry.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
