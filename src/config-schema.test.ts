import { describe, expect, it, vi } from 'vitest';
import { getDefaultsFromConfigSchema } from '@openmrs/esm-framework';
import { configSchema } from './config-schema';

describe('configSchema', () => {
  it("defaults to the clinic tags, RHD flags and the consultation form's urgency bands", () => {
    expect(getDefaultsFromConfigSchema(configSchema)).toEqual({
      clinicLocationTags: {
        cardiac: ['RHD Tertiary', 'RHD District'],
        primaryCare: ['RHD Community'],
      },
      flagLists: {
        namePrefix: 'RHD ',
        names: [],
        riskFlags: ['RHD prophylaxis overdue', 'RHD lost to follow-up', 'RHD no data for 5 months'],
        flagForms: [
          {
            flag: 'b1f7a2c0-0005-4a00-9000-000000000005',
            form: '4b063fc7-996f-3001-8500-8940e201be8f',
            concept: '668e0221-8b41-5669-9ad8-78e193d42494',
          },
        ],
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
      dataClerkQuickActions: {
        facilityReportUrl: '${openmrsSpaBase}/home/act-facility-reports',
      },
      adminLinks: {
        usersUrl: '${openmrsBase}/admin/users/users.list',
        clinicsUrl: '${openmrsBase}/admin/locations/location.list',
        studiesUrl: '${openmrsSpaBase}/home/act-studies',
        refreshFlagsUrl: '${openmrsSpaBase}/home/act-refresh-flags',
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
      dueForProphylaxis: {
        report: 'f3d8b672-a8a3-47a3-8a0b-dff01de6e3a8',
      },
      screenPositive: {
        report: 'e3b8f7a2-6c41-4d9e-8a57-1f0c2d4b9e63',
      },
      programmeReport: {
        report: 'c4a9e2d1-7b3f-4e58-9a16-2f0d8b5c7e31',
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
        ecgForm: '3776bb8d-4741-3741-aeef-d5b760443569',
        ecgEncounterType: '64c3f35f-a3ec-59d6-8178-0ca9f068cda8',
        ecgConcepts: {
          date: 'a85d4e63-500f-5af9-8ebd-9e1db5ddc3ed',
          result: '1c5476e4-ff12-5fbd-b2ad-53f66f9006a0',
          otherFinding: '67d65827-eea5-57ac-ae8b-77f91d128063',
        },
      },
      prophylaxisPage: {
        bpgEncounterType: '04cf03db-3b8e-5020-84b0-50b06338767a',
        oralEncounterType: '55271793-ef37-58da-9d86-1d9092a5a809',
        concepts: {
          injectionDate: '183fb30e-b861-5b7c-806f-7118a40f2b51',
          doseGiven: '6a52b6aa-2427-4fa2-93cb-18956f50c16a',
          facility: '01e6dd39-b8ba-5b0a-bcd7-6b8d5973c1bc',
          lateReason: 'f7cbfcdc-58bb-5e85-86ab-ffce26a08615',
          weeks: '75cd7e15-5f05-58d1-acb1-4a046eb1b437',
          adherence: '8edff8dc-4af6-5d0f-bf1d-8e349c7a1b15',
        },
      },
      consultations: {
        form: '4b063fc7-996f-3001-8500-8940e201be8f',
        encounterType: 'c2503561-c00d-5460-8157-43d594472b4a',
        concepts: {
          date: 'c3edefd2-5777-5084-b01e-fd4ca0e40162',
          nyha: '2f51b894-383c-53bb-9997-583e9761d132',
          prophylaxis: '668e0221-8b41-5669-9ad8-78e193d42494',
          cardiacMedication: '0734567e-4f0a-5090-9d74-b953921a30e6',
          dosing: '8879385e-d35e-50a3-a3d0-4333d95d4878',
          dateStopped: 'd75edc42-3213-5a06-9228-4e5735b9594b',
          nextReviewAmount: 'ba4b8a87-2ce8-559e-9a30-45504a9b6c1f',
          nextReviewPeriod: '1732AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        },
        periods: {
          '1072AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': 'day',
          '1073AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': 'week',
          '1074AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': 'month',
          '1734AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': 'year',
        },
        warfarin: ['5e97fe35-58df-4925-bba7-7c49d75268a1', '3c7f8916-3ab5-5678-83c5-be7c7bb1f5e7'],
      },
      inr: {
        form: 'fe4848b2-a0b4-329f-a6a3-6ffc298e09a9',
        encounterType: 'b4bb88a3-9a04-5142-85bd-bb63c270f632',
        concepts: {
          target: '0778ce12-ddba-5e22-b5fd-92424e8747b4',
          dateTested: 'be9041b1-3948-5de0-a8b1-974e84b95715',
          value: '161482AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          newDose: 'f27f6ed2-48db-5be7-91da-3e2483915462',
          nextDate: '5096AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        },
      },
      diagnosis: {
        encounterType: 'ffdc883f-f99f-496a-83f9-2c3c581e1af0',
        concepts: {
          diagnosis: '594b4495-36dc-52a6-9810-15a9e2e2dcb9',
          category: '1a5aa050-661d-5e89-95d7-c1eba476df22',
          priority: '97c025b2-f42c-5c53-8aaa-0506c8dd3774',
          active: 'b1b5d279-8013-5ae4-83a7-0f2bd9bc8457',
        },
        details: [
          'cfe17bb5-4a76-5f3a-9e1c-7b1e9b84a8e3',
          'd3f6e1a2-9c5b-5e84-8f2d-1a6c7b9e0d4f',
          'b7a2c4d8-5e91-5f3a-8c6d-2b9e4f7a1c0d',
          'e9f3a5c7-6b82-5d4e-9f1a-3c7d8e2b5f4a',
        ],
        secondary: 'af45fb2a-ed18-5beb-935e-8e4d92df2dac',
        no: '488b58ff-64f5-4f8a-8979-fa79940b1594',
      },
      contact: {
        phone: ['542c6fd2-05ca-53e3-a4f5-cd23bc1abd8f', '14d4f066-15f5-102d-96e4-000c29c2a5d7'],
        phoneOwner: 'ea3cb7ae-ffbe-5aee-8343-44977898f675',
        primaryCareClinic: ['695f2990-236f-5d7c-b8aa-ddbdb22400f4', '8d87236c-c2cc-11de-8d13-0010c6dffd0f'],
        cardiacClinic: 'fe261119-2911-5b36-be40-8f9827826987',
        tertiaryTag: 'RHD Tertiary',
      },
      bannerFlags: {
        cardiologyFollowUp: 'b1f7a2c0-0016-4a00-9000-000000000016',
        inrReview: 'b1f7a2c0-0017-4a00-9000-000000000017',
      },
      nextSteps: { enabled: true },
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
