import { describe, expect, it, vi } from 'vitest';
import { getDefaultsFromConfigSchema } from '@openmrs/esm-framework';
import { configSchema } from './config-schema';

describe('configSchema', () => {
  it('defaults to the ACT privilege, clinic tags, RHD flags and ACT 2.0 urgency bands', () => {
    expect(getDefaultsFromConfigSchema(configSchema)).toEqual({
      screenPrivileges: {
        home: 'View Patient Flags',
        registry: 'View Patient Flags',
        waitingList: 'View Patient Flags',
        screenPositive: 'View Patient Flags',
      },
      clinicLocationTags: {
        cardiac: ['RHD Tertiary', 'RHD District'],
        primaryCare: ['RHD Community'],
      },
      flagLists: {
        namePrefix: 'RHD ',
        names: [],
        riskFlags: ['RHD prophylaxis overdue', 'RHD lost to follow-up'],
      },
      quickActions: {
        registerPatientUrl: '${openmrsSpaBase}/patient-registration',
        enterProphylaxisUrl: '${openmrsSpaBase}/forms',
        findPatientUrl: '${openmrsSpaBase}/search',
      },
      careCascade: {
        report: '9c6751ae-65fc-5f25-9aa6-8c65cb1dff68',
        reportUrl: '${openmrsSpaBase}/reports',
        steps: ['Active', 'Prescribed Prophylaxis', 'Initiated BPG', 'Adherent'],
      },
      registry: {
        report: 'f1a2b3c4-d5e6-7890-abcd-ef1234567890',
        showBpgColumns: false,
      },
      urgencyBands: [
        { label: '1: Emergent', concept: '1fe15210-4490-58b0-a38c-bb0386e98482', deadlineDays: 1 },
        { label: '2: Urgent', concept: '33bf504a-15f2-5504-9bdc-ddded0b5eb00', deadlineDays: 60 },
        { label: '3: Elective', concept: '2666bf97-7400-57c7-b535-7903e22ced34', deadlineDays: 180 },
      ],
    });
  });
});

describe('urgencyBands', () => {
  it.each([
    ['its deadline', { label: '2: Urgent', concept: '33bf504a-15f2-5504-9bdc-ddded0b5eb00' }],
    ['its concept', { label: '2: Urgent', deadlineDays: 60 }],
  ])('reports a band that leaves out %s', async (_, band) => {
    const { clearConfigErrors, processConfig } =
      await vi.importActual<typeof import('@openmrs/esm-config')>('@openmrs/esm-config');
    clearConfigErrors();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    processConfig(configSchema, { urgencyBands: [band] }, 'rhd');

    const messages = consoleError.mock.calls.map((call) => String(call[0]));
    expect(messages.some((message) => message.includes('Every urgency band needs'))).toBe(true);
    consoleError.mockRestore();
  });

  it('reports a band whose deadline is not a number or whose key is misspelled', async () => {
    const { processConfig } = await vi.importActual<typeof import('@openmrs/esm-config')>('@openmrs/esm-config');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    processConfig(
      configSchema,
      {
        urgencyBands: [
          { label: '2: Urgent', concept: '33bf504a-15f2-5504-9bdc-ddded0b5eb00', deadlineDays: '60' },
          { label: '3: Elective', concept: '2666bf97-7400-57c7-b535-7903e22ced34', deadline: 180 },
        ],
      },
      'rhd',
    );

    const messages = consoleError.mock.calls.map((call) => String(call[0]));
    expect(messages.some((message) => message.includes('urgencyBands[0].deadlineDays'))).toBe(true);
    expect(messages.some((message) => message.includes('urgencyBands[1].deadline'))).toBe(true);
    consoleError.mockRestore();
  });
});
