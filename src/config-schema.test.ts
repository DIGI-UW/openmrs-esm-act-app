import { describe, expect, it, vi } from 'vitest';
import { getDefaultsFromConfigSchema } from '@openmrs/esm-framework';
import { configSchema } from './config-schema';

describe('configSchema', () => {
  it("defaults to the ACT privilege, clinic tags, RHD flags and the consultation form's urgency bands", () => {
    expect(getDefaultsFromConfigSchema(configSchema)).toEqual({
      screenPrivileges: {
        home: 'View Patient Flags',
        registry: 'View Patient Flags',
        worklists: 'View Patient Flags',
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
        enterProphylaxisInFastDataEntry: false,
        enterProphylaxisUrl: '${openmrsSpaBase}/forms',
        prophylaxisForms: [
          { label: 'Enter BPG', url: '${openmrsSpaBase}/forms/form/0119d2e6-e2e1-391c-9b88-d59a10b0780d' },
          { label: 'Enter oral prophylaxis', url: '${openmrsSpaBase}/forms/form/ba29e982-ce18-302a-9fc4-d4b2c3983465' },
        ],
        findPatientInPanel: true,
        findPatientUrl: '${openmrsSpaBase}/search?query=',
      },
      careCascade: {
        report: '9c6751ae-65fc-5f25-9aa6-8c65cb1dff68',
        reportUrl: '${openmrsSpaBase}/reports',
        steps: [
          { step: 'Active', label: 'Active' },
          { step: 'Prescribed', label: 'Prescribed' },
          { step: 'Prescribed Prophylaxis', label: 'Prescribed' },
          { step: 'Initiated', label: 'Initiated' },
          { step: 'Initiated BPG', label: 'Initiated' },
          { step: 'Covered today', label: 'Covered today' },
          { step: 'Adherent (80%+)', label: 'Adherent (80%+)' },
          { step: 'Adherent', label: 'Adherent (80%+)' },
        ],
      },
      registry: {
        report: 'f1a2b3c4-d5e6-7890-abcd-ef1234567890',
        showBpgColumns: false,
      },
      waitingList: {
        report: '5b0f1c2e-9d3a-4c1b-8f6e-2a7d9e4b3c10',
      },
      screenPositive: {
        report: 'e3b8f7a2-6c41-4d9e-8a57-1f0c2d4b9e63',
        echoForm: '88e54fb0-1243-3f7a-b925-f64648ca6635',
      },
      cardiacTests: {
        echoForm: '88e54fb0-1243-3f7a-b925-f64648ca6635',
        echoEncounterType: '730f5ec2-7102-55d0-8602-2d792844f245',
        concepts: {
          date: '911be530-9457-54be-8515-4bbcdb832ccb',
          mitralRegurgitation: 'd6ab05e2-1ece-5f8f-893d-74739aa66ce5',
          mitralStenosis: 'ed209fc3-0138-516c-a0bd-bcd3b2697a87',
          aorticRegurgitation: '0bbc510f-1e95-5c74-bbe3-8896907fd6c1',
          aorticStenosis: '7586c9a6-73db-5ab2-8f23-71a3cc4bae62',
          ejectionFraction: 'ed630fda-8451-53c0-929e-40eafd9bca9b',
        },
      },
      prophylaxisCard: {
        bpgForm: '0119d2e6-e2e1-391c-9b88-d59a10b0780d',
        oralForm: 'ba29e982-ce18-302a-9fc4-d4b2c3983465',
      },
      actIdentifierType: '240f85fa-46e1-540e-9234-2796c623f7ea',
      visitType: 'bf86d5a7-9511-5c11-acb1-8f8718775cd5',
      urgencyBands: [
        {
          label: '1: Emergent (24 hours)',
          shortLabel: '1: Emergent',
          concept: '1fe15210-4490-58b0-a38c-bb0386e98482',
          deadlineDays: 1,
        },
        { label: '1 - within 1 week', concept: '406285f2-be72-5594-8664-c8568ad9bc88', deadlineDays: 7 },
        { label: '2 - within 1 month', concept: '82c5209b-c183-5bc9-941c-890eba821a44', deadlineDays: 30 },
        {
          label: '2: Urgent (60 days)',
          shortLabel: '2: Urgent',
          concept: '33bf504a-15f2-5504-9bdc-ddded0b5eb00',
          deadlineDays: 60,
        },
        { label: '3 - within 3 months', concept: '925610f9-1c3c-5396-880f-02a5fe309d53', deadlineDays: 90 },
        {
          label: '3: Elective (180 days)',
          shortLabel: '3: Elective',
          concept: '2666bf97-7400-57c7-b535-7903e22ced34',
          deadlineDays: 180,
        },
        { label: '4 - within 6 months', concept: '57e3873e-018e-5ed6-b7d4-5f73ef464cbd', deadlineDays: 180 },
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
