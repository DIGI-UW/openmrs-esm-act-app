import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PRIVILEGE_ADD_ENCOUNTERS, PRIVILEGE_DATA_CLERK } from '../constants';
import { signInWith } from '../access/sign-in.test-helper';
import DataClerkHome from './data-clerk-home.component';

// Which form each search opens is enter-prophylaxis's own test; here it shows which prophylaxis it was given.
vi.mock('../enter-prophylaxis/enter-prophylaxis.component', () => ({
  EnterProphylaxisSearch: ({ prophylaxis }: { prophylaxis: string }) => <div role="dialog" aria-label={prophylaxis} />,
}));

describe('DataClerkHome', () => {
  beforeEach(async () => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    await signInWith([PRIVILEGE_DATA_CLERK, PRIVILEGE_ADD_ENCOUNTERS]);
  });

  it.each([
    ['Record BPG', 'bpg'],
    ['Record oral', 'oral'],
  ])("opens ACT's patient search for that prophylaxis from %s", async (name, prophylaxis) => {
    render(<DataClerkHome />);

    await userEvent.click(screen.getByRole('button', { name }));

    expect(screen.getByRole('dialog', { name: prophylaxis })).toBeInTheDocument();
  });

  it('links Facility report to its configured target', () => {
    render(<DataClerkHome />);

    expect(screen.getByRole('link', { name: /facility report/i })).toHaveAttribute('href', '/openmrs/spa/home/reports');
  });

  it('offers no Record action to a user who cannot add encounters', async () => {
    await signInWith([PRIVILEGE_DATA_CLERK]);

    render(<DataClerkHome />);

    expect(screen.queryByRole('button', { name: /record/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /facility report/i })).toBeInTheDocument();
  });
});
