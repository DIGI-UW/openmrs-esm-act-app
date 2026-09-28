import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { type Config } from '../config-schema';
import { homePrivilege, signInWith } from '../access/sign-in.test-helper';
import QuickActions from './quick-actions.component';

const defaultQuickActions: Config['quickActions'] = {
  registerPatientUrl: '${openmrsSpaBase}/patient-registration',
  enterProphylaxisUrl: '${openmrsSpaBase}/forms',
  findPatientUrl: '${openmrsSpaBase}/search',
};

describe('QuickActions', () => {
  beforeEach(async () => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    await signInWith([homePrivilege]);
  });

  it('links register patient, enter prophylaxis and find a patient to their screens', () => {
    render(<QuickActions />);

    expect(screen.getByRole('link', { name: /register patient/i })).toHaveAttribute(
      'href',
      '/openmrs/spa/patient-registration',
    );
    expect(screen.getByRole('link', { name: /enter prophylaxis/i })).toHaveAttribute('href', '/openmrs/spa/forms');
    expect(screen.getByRole('link', { name: /find a patient/i })).toHaveAttribute('href', '/openmrs/spa/search');
  });

  it('uses the links set in the config', async () => {
    await signInWith([homePrivilege], {
      quickActions: { ...defaultQuickActions, enterProphylaxisUrl: '${openmrsSpaBase}/forms/prophylaxis' },
    });

    render(<QuickActions />);

    expect(screen.getByRole('link', { name: /enter prophylaxis/i })).toHaveAttribute(
      'href',
      '/openmrs/spa/forms/prophylaxis',
    );
  });

  it('is hidden from a user without the ACT home privilege', async () => {
    await signInWith(['View Patient Flags']);

    render(<QuickActions />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
