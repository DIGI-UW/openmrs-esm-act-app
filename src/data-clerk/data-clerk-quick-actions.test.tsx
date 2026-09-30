import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { dataClerkPrivilege, signInWith } from '../access/sign-in.test-helper';
import DataClerkQuickActions from './data-clerk-quick-actions.component';

describe('DataClerkQuickActions', () => {
  beforeEach(async () => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    await signInWith([dataClerkPrivilege]);
  });

  it('links each of the five quick actions to its configured target', () => {
    render(<DataClerkQuickActions />);

    expect(screen.getByRole('link', { name: /record bpg injection/i })).toHaveAttribute(
      'href',
      '/openmrs/spa/forms/form/0119d2e6-e2e1-391c-9b88-d59a10b0780d',
    );
    expect(screen.getByRole('link', { name: /record oral prophylaxis/i })).toHaveAttribute(
      'href',
      '/openmrs/spa/forms/form/ba29e982-ce18-302a-9fc4-d4b2c3983465',
    );
    expect(screen.getByRole('link', { name: /register patient/i })).toHaveAttribute(
      'href',
      '/openmrs/spa/patient-registration',
    );
    expect(screen.getByRole('link', { name: /find a patient/i })).toHaveAttribute('href', '/openmrs/spa/search?query=');
    expect(screen.getByRole('link', { name: /facility report/i })).toHaveAttribute('href', '/openmrs/spa/home/reports');
  });

  it('is hidden from a user without the data clerk privilege', async () => {
    await signInWith(['View Patient Flags']);

    render(<DataClerkQuickActions />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
