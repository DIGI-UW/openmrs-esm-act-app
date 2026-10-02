import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FilterEmptyState, TableEmptyState } from './empty-state.component';

describe('Table empty states', () => {
  it('draws an empty table with the empty card illustration and what is missing', () => {
    render(<TableEmptyState message="There are no registry patients to display" />);

    expect(screen.getByTestId('table-empty-state')).toHaveTextContent('There are no registry patients to display');
    expect(screen.getByTestId('empty-card-illustration')).toBeInTheDocument();
  });

  it('says to check the filters when they match nothing', () => {
    render(<FilterEmptyState message="No patients to display" />);

    expect(screen.getByTestId('filter-empty-state')).toHaveTextContent('No patients to displayCheck the filters above');
  });
});
