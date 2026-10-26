import { describe, expect, it, vi } from 'vitest';
import { getDefaultsFromConfigSchema } from '@openmrs/esm-framework';
import { configSchema } from './config-schema';
import en from '../translations/en.json';
import { flagWorklists } from './worklists/flag-worklists';

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
        riskFlags: ['RHD prophylaxis overdue', 'RHD oral prophylaxis overdue', 'RHD lost to follow-up'],
        earlyWarningFlags: [
          'RHD cardiology follow-up due',
          'RHD INR review due',
          'RHD no data for 5 months',
          'RHD referred to a clinician',
        ],
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
          { label: 'enterBpg', url: '${openmrsSpaBase}/forms/form/0119d2e6-e2e1-391c-9b88-d59a10b0780d' },
          { label: 'enterOralProphylaxis', url: '${openmrsSpaBase}/forms/form/ba29e982-ce18-302a-9fc4-d4b2c3983465' },
        ],
        findPatientInPanel: true,
        findPatientUrl: '${openmrsSpaBase}/search?query=',
      },
      dataClerkQuickActions: {
        facilityReportUrl: '${openmrsSpaBase}/home/act-facility-reports',
      },
      instanceAdminQuickActions: {
        formsAndSitesUrl: '${openmrsBase}/admin/forms/form.list',
        rolePermissionsUrl: '${openmrsBase}/admin/users/users.list',
        researchParticipationUrl: '${openmrsBase}/admin/maintenance/settings.list',
      },
      instanceAdminKpis: { report: '6494be01-b4ae-46af-8d7f-058a2f95c115' },
      users: {
        roleChoices: [
          {
            administratorRole: 'c95f35f4-0422-46a3-a593-a6615fab90bc',
            roles: [
              'b9ab4b76-e7b9-46a7-b4ec-5b7fdd8fa540',
              '61e9bb28-11df-4df1-965d-11ef928d5239',
              '60625a0c-3cea-4fe5-b6ca-615c743ad9d4',
              'a1295a20-7273-4339-b5df-2f8a3a841c77',
              '07a7affa-b7de-46d9-9faa-aac4ef2eccba',
              'c95f35f4-0422-46a3-a593-a6615fab90bc',
            ],
          },
          {
            administratorRole: '07a7affa-b7de-46d9-9faa-aac4ef2eccba',
            roles: [
              'b9ab4b76-e7b9-46a7-b4ec-5b7fdd8fa540',
              '61e9bb28-11df-4df1-965d-11ef928d5239',
              '60625a0c-3cea-4fe5-b6ca-615c743ad9d4',
              'a1295a20-7273-4339-b5df-2f8a3a841c77',
            ],
          },
          {
            administratorRole: 'a1295a20-7273-4339-b5df-2f8a3a841c77',
            roles: [
              'b9ab4b76-e7b9-46a7-b4ec-5b7fdd8fa540',
              '61e9bb28-11df-4df1-965d-11ef928d5239',
              '60625a0c-3cea-4fe5-b6ca-615c743ad9d4',
            ],
          },
        ],
      },
      adminLinks: {
        usersUrl: '${openmrsSpaBase}/home/act-users',
        clinicsUrl: '${openmrsBase}/admin/locations/location.list',
        studiesUrl: '${openmrsSpaBase}/home/act-studies',
        refreshFlagsUrl: '${openmrsSpaBase}/home/act-refresh-flags',
        logsUrl: '${openmrsSpaBase}/home/act-logs',
        auditLogsUrl: '${openmrsBase}/module/auditlogweb/auditlogs.form',
        readAuditUrl: '${openmrsBase}/module/auditlogweb/readauditlogs.form',
        securityAuditUrl: '${openmrsBase}/module/auditlogweb/securityauditlogs.form',
        downloadUrl: '${openmrsSpaBase}/home/act-download',
      },
      careCascade: {
        report: '9c6751ae-65fc-5f25-9aa6-8c65cb1dff68',
        reportUrl: '${openmrsSpaBase}/reports',
        steps: [
          { step: 'Active', label: 'active' },
          { step: 'Prescribed', label: 'prescribed' },
          { step: 'Prescribed Prophylaxis', label: 'prescribed' },
          { step: 'Initiated', label: 'initiated' },
          { step: 'Initiated BPG', label: 'initiated' },
          { step: 'Covered today', label: 'coveredToday' },
          { step: 'Adherent (80%+)', label: 'adherentEightyPercent' },
          { step: 'Adherent', label: 'adherentEightyPercent' },
        ],
      },
      registry: {
        report: 'f1a2b3c4-d5e6-7890-abcd-ef1234567890',
        showBpgColumns: false,
      },
      dashboard: {
        registrantsReport: '3b0a6c2e-8f41-5d7b-9e15-6a2c4d8f0b71',
        waitlistReport: '9d4e2f7a-1c63-5b08-8a2d-4f6e1b9c3a52',
        showScreening: true,
        screeningReport: '0f4b7c2d-6a1e-5d93-8b47-2c9e1f5a3d68',
        registrantPatientsReport: 'e8296d2d-def8-5f8e-ba2d-78c59859b9e3',
        waitlistPatientsReport: 'bc987343-8b70-5f95-84a8-d017cffa14da',
        cascadePatientsReport: '7c62fcfd-03b2-5d84-9cea-92a43b70ae76',
        optimisationPatientsReport: '45c646b2-f223-585e-963a-3c74fe883ae4',
        medicalOptimisationReport: '733a512c-3243-4e91-a44a-06a8e5384606',
        screeningCascadeReport: '8b257a0c-7e96-5a01-9672-975cae3b0419',
        screeningDiagnosesReport: '6ddf6b36-2789-4733-8433-a877d54795cf',
      },
      consultations: {
        encounterType: 'c2503561-c00d-5460-8157-43d594472b4a',
        form: '4b063fc7-996f-3001-8500-8940e201be8f',
        concepts: {
          date: 'c3edefd2-5777-5084-b01e-fd4ca0e40162',
          nyha: '2f51b894-383c-53bb-9997-583e9761d132',
          prophylaxis: '668e0221-8b41-5669-9ad8-78e193d42494',
          dateStopped: 'd75edc42-3213-5a06-9228-4e5735b9594b',
          nextAmount: 'ba4b8a87-2ce8-559e-9a30-45504a9b6c1f',
          nextPeriod: '1732AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          medication: '0734567e-4f0a-5090-9d74-b953921a30e6',
          medicationDose: '8879385e-d35e-50a3-a3d0-4333d95d4878',
          medicationInterval: '04d77200-fa10-5c15-b58a-609bf8eadefb',
          dateStarted: '5bcc7d12-b279-5955-815c-090a1f392071',
          dateAdded: 'b8514967-2259-5a4d-9ac5-b9319144b8dc',
          chronicCondition: 'd80478b2-4ed2-5d93-a604-6b5b50dab441',
          allergy: 'cd73e118-64ee-5855-b276-f7cb44fdcf7e',
          complication: 'a04d2268-a7de-589f-b4b6-92c47c13e342',
          recommendation: 'ce93d393-1df5-587f-bf11-c373eac2ccf4',
          completed: '1632f8dc-195d-5d67-a52e-6c7a057cb536',
        },
        vitaminKAntagonists: ['5e97fe35-58df-4925-bba7-7c49d75268a1', '3c7f8916-3ab5-5678-83c5-be7c7bb1f5e7'],
      },
      inrReviews: {
        encounterType: 'b4bb88a3-9a04-5142-85bd-bb63c270f632',
        form: 'fe4848b2-a0b4-329f-a6a3-6ffc298e09a9',
        concepts: {
          target: '0778ce12-ddba-5e22-b5fd-92424e8747b4',
          group: 'bd88ecf3-eac2-516a-8949-a93f90d6483b',
          dateTested: 'be9041b1-3948-5de0-a8b1-974e84b95715',
          value: '161482AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
          newDose: 'f27f6ed2-48db-5be7-91da-3e2483915462',
          nextInr: '5096AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        },
      },
      contactCard: {
        attributeTypes: {
          phone: '542c6fd2-05ca-53e3-a4f5-cd23bc1abd8f',
          phoneOwner: 'ea3cb7ae-ffbe-5aee-8343-44977898f675',
          primaryCareClinic: '695f2990-236f-5d7c-b8aa-ddbdb22400f4',
          cardiacClinic: 'fe261119-2911-5b36-be40-8f9827826987',
        },
      },
      clinicianPrivilege: 'Task: act.enterClinicalForms',
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
      studies: {
        participantsReport: 'ea8687da-4bed-5e2b-bafa-7a11ad9bc3ae',
        studyParticipantIdAttributeType: '7840ba5d-d927-52d6-907b-dd070bea6626',
        researchOptInAttributeType: 'a78f6ae3-faec-5db8-9493-53877985ca7f',
        consentAttributeType: 'e15bf9b7-249e-5d75-907d-937b8d9b0c46',
        yesConcept: '1065AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        noConcept: '1066AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
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
          estimateDate: '99512ab5-208e-5c37-8f7b-8f72abe2a0db',
          adherence: '8edff8dc-4af6-5d0f-bf1d-8e349c7a1b15',
          basedOn: '4313005d-d5b2-5d20-bf33-39aab1bf90c0',
          lowAdherenceReason: 'a9fbf67b-65d7-57f6-8270-7bb65cd49469',
          newPrescription: 'cd03af00-de81-5c08-9a02-92f95c00e1ce',
        },
      },
      nextSteps: { enabled: true },
      prophylaxisCard: {
        bpgForm: '0119d2e6-e2e1-391c-9b88-d59a10b0780d',
        oralForm: 'ba29e982-ce18-302a-9fc4-d4b2c3983465',
      },
      prophylaxisUpdate: {
        encounterType: '8a51f352-5f1b-4836-a669-536e276a21db',
        concepts: {
          prescription: '668e0221-8b41-5669-9ad8-78e193d42494',
          dateStarted: '5bcc7d12-b279-5955-815c-090a1f392071',
          dateStopped: 'd75edc42-3213-5a06-9228-4e5735b9594b',
          reasonStopped: 'fa21e431-e64d-5493-b18c-9a1eaf7ee16a',
          duration: '11117263-f71d-58e2-8363-d2e9b1dbddab',
          consultationDate: 'c3edefd2-5777-5084-b01e-fd4ca0e40162',
          none: '1107AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        },
        regimens: [
          { uuid: '50be4b26-6c5b-5aaa-9254-3bfd313b4522', label: 'Q28 day BPG' },
          { uuid: '2f3ee632-dd14-51b0-a4ec-de10e7958019', label: 'Q21 day BPG' },
          { uuid: '91230c88-6a90-5d45-af50-fa6155fe5dd7', label: 'Q14 day BPG' },
          { uuid: 'b9884219-358a-594b-94f5-f8a8863a25f3', label: 'Oral penicillin V' },
          { uuid: 'f2e06eb2-5c25-5e53-9e01-246112d05976', label: 'Oral sulfadiazine' },
          { uuid: 'fb8b6676-689b-5daa-83f7-1456210c587f', label: 'Oral erythromycin' },
          { uuid: 'f6f25d63-bd1a-51cb-9596-e74a19759429', label: 'Oral clarithromycin' },
          { uuid: '1af922b8-acee-56c8-b184-eaef4e58e23a', label: 'Oral azithromycin' },
          { uuid: '5622AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', label: 'Other non-coded' },
        ],
        durations: [
          { uuid: '6f2c4ca8-a499-5851-975b-5bfb426143a9', label: '1 year and reassess' },
          { uuid: 'a3f9bcd3-787f-58b3-ae36-c494725a67eb', label: '2 years and reassess' },
          { uuid: '024cdfe6-c2eb-521c-8616-4729ac35439e', label: '5 years or until age 21, whichever is longer' },
          { uuid: 'ecc08a4c-6494-5737-b142-f59d18c07db1', label: '10 years or until age 40, whichever is longer' },
          { uuid: 'e13a5d80-2ba1-5927-b4e6-7369473222e1', label: 'Lifetime' },
        ],
        reasons: [
          { uuid: '121689AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', label: 'Allergy' },
          { uuid: '148888AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', label: 'Anaphylaxis' },
          { uuid: 'eaf16fa9-03d7-5846-94c3-b02805889ed9', label: 'Provider stopped' },
          { uuid: '39af49bd-5dd0-5acd-8ffb-260bc83dbfd7', label: 'Patient preference' },
          { uuid: '5622AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', label: 'Other non-coded' },
        ],
      },
      patientStatus: {
        programUuid: '7d73e143-a550-5a9d-aecd-dd771add098d',
        deathConcept: '159AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      },
      actIdentifierType: '240f85fa-46e1-540e-9234-2796c623f7ea',
      procedures: {
        encounterType: 'c9b87090-8768-50be-987e-8ca0a8983429',
        concepts: {
          date: '6cbb5176-144a-576b-9b3d-c9e9d6bc5f5a',
          surgeryType: '46f4af80-b783-59f4-beb1-81144ccf3084',
          catheterizationType: 'bb4a77ee-836a-57e7-a262-632fa22288d2',
        },
      },
      patientInformationForm: 'a6646c51-130d-3b59-a442-959bea93487d',
      singleRecordForms: ['a6646c51-130d-3b59-a442-959bea93487d', '7807da80-ee71-3900-bbce-a026e4a8d54d'],
      visitType: 'bf86d5a7-9511-5c11-acb1-8f8718775cd5',
      sessionTimeout: { idleMinutes: 30, warningMinutes: 3, keepAliveMinutes: 10 },
      urgencyBands: [
        {
          label: 'urgencyEmergent',
          shortLabel: '1: Emergent',
          concept: '1fe15210-4490-58b0-a38c-bb0386e98482',
          deadlineDays: 1,
        },
        { label: 'urgencyWithinOneWeek', concept: '406285f2-be72-5594-8664-c8568ad9bc88', deadlineDays: 7 },
        { label: 'urgencyWithinOneMonth', concept: '82c5209b-c183-5bc9-941c-890eba821a44', deadlineDays: 30 },
        {
          label: 'urgencyUrgent',
          shortLabel: '2: Urgent',
          concept: '33bf504a-15f2-5504-9bdc-ddded0b5eb00',
          deadlineDays: 60,
        },
        { label: 'urgencyWithinThreeMonths', concept: '925610f9-1c3c-5396-880f-02a5fe309d53', deadlineDays: 90 },
        {
          label: 'urgencyElective',
          shortLabel: '3: Elective',
          concept: '2666bf97-7400-57c7-b535-7903e22ced34',
          deadlineDays: 180,
        },
        { label: 'urgencyWithinSixMonths', concept: '57e3873e-018e-5ed6-b7d4-5f73ef464cbd', deadlineDays: 180 },
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

describe('default labels', () => {
  it('are each a key in en.json, as the app translates a label by it', () => {
    const { careCascade, quickActions, urgencyBands } = getDefaultsFromConfigSchema(configSchema);
    const labels = [
      ...careCascade.steps.map((step) => step.label),
      ...quickActions.prophylaxisForms.map((form) => form.label),
      ...urgencyBands.map((band) => band.label),
      ...Object.values(flagWorklists).map((worklist) => worklist.title),
    ];

    expect(labels.filter((label) => typeof en[label] !== 'string')).toEqual([]);
  });
});
