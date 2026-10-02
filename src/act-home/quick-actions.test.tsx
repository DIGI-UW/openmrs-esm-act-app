import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getDefaultsFromConfigSchema } from '@openmrs/esm-framework';
import { type Config, configSchema } from '../config-schema';
import { homePrivilege, signInWith } from '../access/sign-in.test-helper';
import QuickActions from './quick-actions.component';

const defaultQuickActions: Config['quickActions'] = {
  registerPatientUrl: '${openmrsSpaBase}/patient-registration',
  enterProphylaxisInFastDataEntry: true,
  enterProphylaxisUrl: '${openmrsSpaBase}/forms',
  prophylaxisForms: [],
  findPatientInPanel: false,
  findPatientUrl: '${openmrsSpaBase}/search?query=',
};

// Enter prophylaxis switched back to fast data entry, with the default BPG and oral forms.
async function signInWithFastDataEntry() {
  const { quickActions } = getDefaultsFromConfigSchema(configSchema) as Config;
  await signInWith([homePrivilege], { quickActions: { ...quickActions, enterProphylaxisInFastDataEntry: true } });
}

describe('QuickActions', () => {
  beforeEach(async () => {
    window.getOpenmrsSpaBase = () => '/openmrs/spa/';
    await signInWith([homePrivilege]);
  });

  it('links register patient and find a patient to their screens', async () => {
    await signInWith([homePrivilege], { quickActions: defaultQuickActions });
    render(<QuickActions />);

    expect(screen.getByRole('link', { name: /register patient/i })).toHaveAttribute(
      'href',
      '/openmrs/spa/patient-registration',
    );
    // With an empty query, because the patient search app of 11.1.1-pre crashes on a /search page load without one.
    expect(screen.getByRole('link', { name: /find a patient/i })).toHaveAttribute('href', '/openmrs/spa/search?query=');
  });

  it("opens ACT's patient search over the page from Find a patient", async () => {
    render(<QuickActions />);

    await userEvent.click(screen.getByRole('button', { name: /find a patient/i }));

    expect(screen.getByRole('dialog', { name: 'Find a patient' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Close search' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it("opens Enter prophylaxis's patient search by default", async () => {
    render(<QuickActions />);

    await userEvent.click(screen.getByRole('button', { name: /enter prophylaxis/i }));

    expect(screen.getByRole('dialog', { name: 'Enter prophylaxis' })).toHaveTextContent('Which prophylaxis?');
  });

  it('offers BPG and oral prophylaxis as ACT 2.0 did, each opening its form in fast data entry', async () => {
    await signInWithFastDataEntry();
    render(<QuickActions />);

    const enter = screen.getByRole('button', { name: /enter prophylaxis/i });
    expect(enter).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: /enter bpg/i })).not.toBeInTheDocument();

    await userEvent.click(enter);

    expect(enter).toHaveAttribute('aria-expanded', 'true');
    const choices = within(screen.getByRole('list', { name: /enter prophylaxis/i })).getAllByRole('link');
    expect(choices.map((choice) => [choice.textContent, choice.getAttribute('href')])).toEqual([
      ['Enter BPG', '/openmrs/spa/forms/form/0119d2e6-e2e1-391c-9b88-d59a10b0780d'],
      ['Enter oral prophylaxis', '/openmrs/spa/forms/form/ba29e982-ce18-302a-9fc4-d4b2c3983465'],
    ]);
  });

  it('hides the choices again when enter prophylaxis is clicked a second time', async () => {
    await signInWithFastDataEntry();
    render(<QuickActions />);

    await userEvent.click(screen.getByRole('button', { name: /enter prophylaxis/i }));
    await userEvent.click(screen.getByRole('button', { name: /enter prophylaxis/i }));

    expect(screen.queryByRole('link', { name: /enter bpg/i })).not.toBeInTheDocument();
  });

  it('links enter prophylaxis straight to its screen when no prophylaxis forms are configured', async () => {
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
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
