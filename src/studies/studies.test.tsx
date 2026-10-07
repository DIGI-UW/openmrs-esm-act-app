import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { signInWith } from '../access/sign-in.test-helper';
import Studies from './studies.component';

describe('Studies', () => {
  beforeEach(async () => {
    await signInWith(['Manage Locations']);
  });

  it('shows the page title and four KPI tiles with their dummy values', () => {
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
