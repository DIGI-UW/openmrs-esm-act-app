import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { homePrivilege, signInWith } from '../access/sign-in.test-helper';
import { useReportDataset } from '../reports/report-dataset.resource';
import { screenPositiveRows } from '../screen-positive/screen-positive.fixture';
import ScreenPositiveRow from './screen-positive-count.component';

vi.mock('../reports/report-dataset.resource', () => ({ useReportDataset: vi.fn() }));
const mockUseReportDataset = vi.mocked(useReportDataset);

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

describe("ACT home's screen positive row, in the care cascade", () => {
  beforeEach(async () => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    await signInWith([homePrivilege, 'View Patient Flags']);
  });

  it("shows how many patients the list's report returns", () => {
    dataset({ rows: screenPositiveRows.slice(0, 3) });

    render(<ScreenPositiveRow />);

    expect(screen.getByTestId('screen-positive-count')).toHaveTextContent('3');
  });

  it('evaluates the report the list uses', () => {
    dataset({ rows: screenPositiveRows });

    render(<ScreenPositiveRow />);

    expect(mockUseReportDataset).toHaveBeenLastCalledWith('e3b8f7a2-6c41-4d9e-8a57-1f0c2d4b9e63');
  });

  it('shows none when no patient is waiting', () => {
    dataset({ rows: [] });

    render(<ScreenPositiveRow />);

    expect(screen.getByTestId('screen-positive-count')).toHaveTextContent('0');
  });

  it('links to the list', () => {
    dataset({ rows: screenPositiveRows });

    render(<ScreenPositiveRow />);

    expect(screen.getByRole('link', { name: /screen positive, pending confirmation/i })).toHaveAttribute(
      'href',
      '/openmrs/spa/home/act-screen-positive',
    );
  });

  it('says so when the report cannot be evaluated', () => {
    dataset({ error: new Error('Server responded with 404') });

    render(<ScreenPositiveRow />);

    expect(screen.getByText('Could not load the screen positive list')).toBeInTheDocument();
    expect(screen.queryByTestId('screen-positive-count')).not.toBeInTheDocument();
  });

  it('shows a placeholder while the report runs', () => {
    dataset({ isLoading: true });

    render(<ScreenPositiveRow />);

    expect(screen.getByTestId('screen-positive-count-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('screen-positive-count')).not.toBeInTheDocument();
  });

  it('is hidden from a user without the screen positive privilege', async () => {
    await signInWith([homePrivilege], { screenPrivileges: { screenPositive: 'App: act.screenpositive' } as never });
    dataset({ rows: screenPositiveRows });

    render(<ScreenPositiveRow />);

    expect(screen.queryByText(/screen positive/i)).not.toBeInTheDocument();
  });
});
