import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PRIVILEGE_DATA_CLERK } from '../constants';
import { signInWith } from '../access/sign-in.test-helper';
import DataClerkHome from './data-clerk-home.component';

describe('DataClerkHome', () => {
  beforeEach(async () => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    await signInWith([PRIVILEGE_DATA_CLERK]);
  });

  it('links each quick action to its configured target', () => {
    render(<DataClerkHome />);

    expect(screen.getByRole('link', { name: /record bpg/i })).toHaveAttribute(
      'href',
      '/openmrs/spa/forms/form/0119d2e6-e2e1-391c-9b88-d59a10b0780d',
    );
    expect(screen.getByRole('link', { name: /record oral/i })).toHaveAttribute(
      'href',
      '/openmrs/spa/forms/form/ba29e982-ce18-302a-9fc4-d4b2c3983465',
    );
    expect(screen.getByRole('link', { name: /facility report/i })).toHaveAttribute('href', '/openmrs/spa/home/reports');
  });

  it('is hidden from a user without the data clerk privilege', async () => {
    await signInWith(['View Patient Flags']);

    render(<DataClerkHome />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
