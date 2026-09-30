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

  it('draws the configured steps of the cascade report, in the configured order, with their labels and counts', () => {
    dataset({ rows: cascade });

    render(<CareCascade />);

    const steps = screen.getAllByTestId('cascade-step');
    expect(steps.map((step) => step.textContent)).toEqual([
      'Active20',
      'Prescribed17',
      'Initiated11',
      'Adherent (80%+)0',
    ]);
  });

  it('draws Covered today once the report returns it', () => {
    dataset({ rows: [...cascade.slice(0, 5), { step_order: 6, step: 'Covered today', patients: 9 }, cascade[5]] });

    render(<CareCascade />);

    expect(screen.getAllByTestId('cascade-step').map((step) => step.textContent)).toEqual([
      'Active20',
      'Prescribed17',
      'Initiated11',
      'Covered today9',
      'Adherent (80%+)0',
    ]);
  });

  it('ends with the screen positive count, opening that list, for a user who may see it', async () => {
    await signInWith([homePrivilege, 'View Patient Flags']);
    dataset({ rows: cascade });

    render(<CareCascade />);

    expect(screen.getByTestId('screen-positive-row')).toHaveTextContent('Screen positive, pending confirmation');
    expect(screen.getByTestId('screen-positive-row')).toHaveAttribute('href', '/openmrs/spa/home/act-screen-positive');
  });

  it('leaves out a configured step the report does not return', async () => {
    await signInWith([homePrivilege], {
      careCascade: {
        report: 'r',
        reportUrl: '${openmrsSpaBase}/reports',
        steps: [
          { step: 'Active', label: 'Active' },
          { step: 'Covered today', label: 'Covered today' },
        ],
      },
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
      careCascade: {
        report: 'RHD Care Cascade',
        reportUrl: '${openmrsSpaBase}/reports',
        steps: [{ step: 'Active', label: 'Active' }],
      },
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
