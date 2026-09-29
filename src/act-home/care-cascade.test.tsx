import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { homePrivilege, signInWith } from '../access/sign-in.test-helper';
import { useReportDataset } from '../reports/report-dataset.resource';
import CareCascade from './care-cascade.component';

vi.mock('../reports/report-dataset.resource', () => ({ useReportDataset: vi.fn() }));
const mockUseReportDataset = vi.mocked(useReportDataset);

const cascade = [
  { step_order: 1, step: 'Active', patients: 20 },
  { step_order: 2, step: 'Prescribed Prophylaxis', patients: 17 },
  { step_order: 3, step: 'Oral', patients: 2 },
  { step_order: 4, step: 'BPG', patients: 15 },
  { step_order: 5, step: 'Initiated BPG', patients: 11 },
  { step_order: 6, step: 'Adherent', patients: 0 },
];

function dataset(value: Partial<ReturnType<typeof useReportDataset>>) {
  mockUseReportDataset.mockReturnValue({
    columns: [],
    rows: [],
    isLoading: false,
    error: undefined,
    mutate: vi.fn(),
    ...value,
  });
}

describe('CareCascade', () => {
  beforeEach(async () => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    await signInWith([homePrivilege]);
  });

  it('draws the configured steps of the cascade report, in the configured order, with their counts', () => {
    dataset({ rows: cascade });

    render(<CareCascade />);

    const steps = screen.getAllByTestId('cascade-step');
    expect(steps.map((step) => step.textContent)).toEqual([
      'Active20',
      'Prescribed Prophylaxis17',
      'Initiated BPG11',
      'Adherent0',
    ]);
  });

  it('leaves out a configured step the report does not return', async () => {
    await signInWith([homePrivilege], {
      careCascade: { report: 'r', reportUrl: '${openmrsSpaBase}/reports', steps: ['Active', 'Covered today'] },
    });
    dataset({ rows: cascade });

    render(<CareCascade />);

    expect(screen.getAllByTestId('cascade-step').map((step) => step.textContent)).toEqual(['Active20']);
  });

  it('sizes each bar against the largest step', () => {
    dataset({ rows: cascade });

    render(<CareCascade />);

    const widths = screen.getAllByTestId('cascade-bar').map((bar) => bar.style.width);
    expect(widths).toEqual(['100%', '85%', '55%', '0%']);
  });

  it('evaluates the configured report up to the start of today, as the reports app runs it for today', () => {
    vi.useFakeTimers({ now: new Date(2026, 8, 28, 10, 30) });
    dataset({ rows: cascade });

    render(<CareCascade />);

    vi.useRealTimers();
    const [report, params] = mockUseReportDataset.mock.calls.at(-1);
    expect(report).toBe('9c6751ae-65fc-5f25-9aa6-8c65cb1dff68');
    expect(new Date(params.endDate).getTime()).toBe(new Date(2026, 8, 28).getTime());
  });

  it('evaluates the report set in the config', async () => {
    await signInWith([homePrivilege], {
      careCascade: { report: 'RHD Care Cascade', reportUrl: '${openmrsSpaBase}/reports', steps: ['Active'] },
    });
    dataset({ rows: cascade });

    render(<CareCascade />);

    expect(mockUseReportDataset.mock.calls.at(-1)[0]).toBe('RHD Care Cascade');
  });

  it('links to the full report', () => {
    dataset({ rows: cascade });

    render(<CareCascade />);

    expect(screen.getByRole('link', { name: /report/i })).toHaveAttribute('href', '/openmrs/spa/reports');
  });

  it('says so when the report has no rows', () => {
    dataset({ rows: [] });

    render(<CareCascade />);

    expect(screen.getByText('No care cascade data')).toBeInTheDocument();
  });

  it('says so when the report cannot be evaluated', () => {
    dataset({ error: new Error('Server responded with 404') });

    render(<CareCascade />);

    expect(screen.getByText('Could not load the care cascade')).toBeInTheDocument();
    expect(screen.queryByTestId('cascade-step')).not.toBeInTheDocument();
  });

  it('shows a placeholder while the report runs', () => {
    dataset({ isLoading: true });

    render(<CareCascade />);

    expect(screen.getByTestId('cascade-loading')).toBeInTheDocument();
  });

  it('is hidden from a user without the ACT home privilege', async () => {
    await signInWith(['View Patient Flags']);
    dataset({ rows: cascade });

    render(<CareCascade />);

    expect(screen.queryByText('Care cascade')).not.toBeInTheDocument();
  });
});
