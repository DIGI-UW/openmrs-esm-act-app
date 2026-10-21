import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ActDocs from './act-docs.component';

describe('ActDocs', () => {
  it('shows the Docs label without an href', () => {
    render(<ActDocs />);
    expect(screen.getByText('Docs')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
