import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdherenceRing } from './adherence-ring.component';

describe('AdherenceRing', () => {
  it('fills the ring to the adherence, with the percentage inside and as its label', () => {
    render(<AdherenceRing value={62} />);

    expect(screen.getByRole('img', { name: 'Adherence 62%' })).toHaveTextContent('62%');
    expect(screen.getByTestId('adherence-arc')).toHaveAttribute('stroke-dasharray', '62 38');
  });

  it.each([
    [99.6, '100'],
    [62.4, '62'],
    [130, '100'],
    [-5, '0'],
  ])('shows %s as %s%%, rounded and kept between 0 and 100', (value, shown) => {
    render(<AdherenceRing value={value} />);

    expect(screen.getByRole('img', { name: `Adherence ${shown}%` })).toHaveTextContent(`${shown}%`);
    expect(screen.getByTestId('adherence-arc')).toHaveAttribute('stroke-dasharray', `${shown} ${100 - Number(shown)}`);
  });
});
