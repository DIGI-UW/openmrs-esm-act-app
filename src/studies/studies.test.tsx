import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { signInWith } from '../access/sign-in.test-helper';
import { useActivePatientCount } from './active-patients.resource';
import Studies from './studies.component';

vi.mock('./active-patients.resource', () => ({ useActivePatientCount: vi.fn() }));

describe('Studies', () => {
  beforeEach(async () => {
    await signInWith(['Manage Locations']);
    vi.mocked(useActivePatientCount).mockReturnValue({ count: 911, isLoading: false, error: undefined });
  });

  it("shows the page title and the active patient count from actcore's registry endpoint", () => {
    render(<Studies />);

    expect(screen.getByRole('heading', { name: 'Studies' })).toBeInTheDocument();

    const tiles = screen.getAllByTestId('studies-tile');
    expect(tiles).toHaveLength(4);
    expect(within(tiles[0]).getByText('Active patients')).toBeInTheDocument();
    expect(within(tiles[0]).getByText('911')).toBeInTheDocument();
    expect(within(tiles[1]).getByText('Due this week')).toBeInTheDocument();
    expect(within(tiles[1]).getByText('64')).toBeInTheDocument();
    expect(within(tiles[2]).getByText('Overdue')).toBeInTheDocument();
    expect(within(tiles[2]).getByText('41')).toBeInTheDocument();
    expect(within(tiles[3]).getByText('BPG on-time rate')).toBeInTheDocument();
    expect(within(tiles[3]).getByText('86%')).toBeInTheDocument();
  });

  it('shows a loading skeleton while the active patient count is loading', () => {
    vi.mocked(useActivePatientCount).mockReturnValue({ count: undefined, isLoading: true, error: undefined });

    render(<Studies />);

    const tiles = screen.getAllByTestId('studies-tile');
    expect(within(tiles[0]).queryByText(/^\d/)).not.toBeInTheDocument();
    expect(within(tiles[0]).getByText('Active patients')).toBeInTheDocument();
  });

  it('falls back to a dash when the active patient count cannot be loaded', () => {
    vi.mocked(useActivePatientCount).mockReturnValue({
      count: undefined,
      isLoading: false,
      error: new Error('boom'),
    });

    render(<Studies />);

    const tiles = screen.getAllByTestId('studies-tile');
    expect(within(tiles[0]).getByText('–')).toBeInTheDocument();
  });

  it('shows a By facility table with a row per dummy facility and a status tag', () => {
    render(<Studies />);

    expect(screen.getByText('By facility')).toBeInTheDocument();
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    // One header row + four data rows.
    expect(rows).toHaveLength(5);
    expect(within(rows[1]).getByText('Kiswa HC III')).toBeInTheDocument();
    expect(within(rows[1]).getByText('142 active')).toBeInTheDocument();
    expect(within(rows[1]).getByText('91%')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Complete')).toBeInTheDocument();
    expect(within(rows[4]).getByText('Wakiso HC IV')).toBeInTheDocument();
    expect(within(rows[4]).getByText('Duplicates')).toBeInTheDocument();
  });
});
