import { Type, validator } from '@openmrs/esm-framework';

const locationTags = (clinics: string, defaultTags: Array<string>) => ({
  _type: Type.Array,
  _elements: { _type: Type.String },
  _default: defaultTags,
  _description: `Location tags that mark ${clinics}.`,
});

const concept = (description: string, defaultUuid: string) => ({
  _type: Type.ConceptUuid,
  _default: defaultUuid,
  _description: description,
});

const link = (description: string, defaultUrl: string) => ({
  _type: Type.String,
  _default: defaultUrl,
  _description: description,
});

export const configSchema = {
  clinicLocationTags: {
    cardiac: locationTags('cardiac clinics', ['RHD Tertiary', 'RHD District']),
    primaryCare: locationTags('primary care clinics', ['RHD Community']),
  },
  flagLists: {
    namePrefix: {
      _type: Type.String,
      _default: 'RHD ',
      _description:
        "The registry's Flags column and filter show the flags whose names start with this, unless names is set. Each worklist names its own flag in its extension's config.",
    },
    names: {
      _type: Type.Array,
      _elements: { _type: Type.String },
      _default: [],
      _description:
        "The flags, by name, that the registry's Flags column and filter show. When set, namePrefix is not used.",
    },
    riskFlags: {
      _type: Type.Array,
      _elements: { _type: Type.String },
      _default: ['RHD prophylaxis overdue', 'RHD lost to follow-up', 'RHD no data for 5 months'],
      _description: 'The flags, by name, that mark a clinical risk. The lists of every other flag are missing data.',
    },
    flagForms: {
      _type: Type.Array,
      _elements: {
        flag: { _type: Type.UUID, _description: 'The flag, by uuid.' },
        form: { _type: Type.UUID, _description: 'The form to record the missing data on, by uuid.' },
        concept: {
          _type: Type.UUID,
          _default: '',
          _description: 'The question to open the form at, by concept uuid; leave it out to open the form at the top.',
        },
      },
      _default: [
        {
          flag: 'b1f7a2c0-0005-4a00-9000-000000000005',
          form: '4b063fc7-996f-3001-8500-8940e201be8f',
          concept: '668e0221-8b41-5669-9ad8-78e193d42494',
        },
      ],
      _description:
        "The form a flag's missing data is recorded on when the patient has no saved form to complete. The flag's workspace offers it as a new form, also for a flag whose criteria list no missing data, such as a risk flag; a flag not listed here offers the clinical forms list.",
    },
  },
  quickActions: {
    registerPatientUrl: link(
      'Where the Register patient quick action on ACT home and on Home leads.',
      '${openmrsSpaBase}/patient-registration',
    ),
    enterProphylaxisInFastDataEntry: {
      _type: Type.Boolean,
      _default: false,
      _description:
        "Whether Enter prophylaxis on ACT home leads to fast data entry (prophylaxisForms, else enterProphylaxisUrl). When false, it opens Enter prophylaxis, the registry's patients on prophylaxis with Record BPG or Record oral on each. It covers Enter prophylaxis only: Record BPG injection and Record oral prophylaxis always open the patient search.",
    },
    enterProphylaxisUrl: link(
      'Where the Enter prophylaxis quick action on ACT home leads, when enterProphylaxisInFastDataEntry is true and prophylaxisForms is empty: the fast data entry app.',
      '${openmrsSpaBase}/forms',
    ),
    prophylaxisForms: {
      _type: Type.Array,
      _elements: {
        label: { _type: Type.String, _description: 'The choice as ACT home shows it.' },
        url: { _type: Type.String, _description: 'Where the choice leads.' },
      },
      _default: [
        { label: 'Enter BPG', url: '${openmrsSpaBase}/forms/form/0119d2e6-e2e1-391c-9b88-d59a10b0780d' },
        { label: 'Enter oral prophylaxis', url: '${openmrsSpaBase}/forms/form/ba29e982-ce18-302a-9fc4-d4b2c3983465' },
      ],
      _description:
        'The choices the Enter prophylaxis quick action offers when enterProphylaxisInFastDataEntry is true, as ACT 2.0 offered BPG and oral prophylaxis; by default the RHD BPG Delivery and RHD Oral Adherence forms in fast data entry. When empty, Enter prophylaxis leads to enterProphylaxisUrl.',
    },
    findPatientInPanel: {
      _type: Type.Boolean,
      _default: true,
      _description:
        "Whether Find a patient on ACT home and on Home opens ACT's patient search over the page. When false, it leads to findPatientUrl.",
    },
    findPatientUrl: link(
      'Where the Find a patient quick action on ACT home and on Home leads when findPatientInPanel is false. The empty query keeps the search page loading when it is refreshed: the patient search app of 11.1.1-pre fails on a /search page load without one.',
      '${openmrsSpaBase}/search?query=',
    ),
  },
  dataClerkQuickActions: {
    facilityReportUrl: link(
      'Where the Facility report quick action on Home leads (Facility reports), for a user holding App: act.dataClerk.',
      '${openmrsSpaBase}/home/act-facility-reports',
    ),
  },
  adminLinks: {
    usersUrl: link(
      "Where the left nav's Users and roles leads: OpenMRS's user management, for a user holding Edit Users.",
      '${openmrsBase}/admin/users/users.list',
    ),
    clinicsUrl: link(
      "Where the left nav's Clinics leads: OpenMRS's locations, for a user holding Manage Locations.",
      '${openmrsBase}/admin/locations/location.list',
    ),
    studiesUrl: link(
      "Where the left nav's Studies leads: the Studies dashboard in this app, for a user holding Manage Locations.",
      '${openmrsSpaBase}/home/act-studies',
    ),
    refreshFlagsUrl: link(
      "Where the left nav's Flags and adherence leads: the page that refreshes them now, for a user holding Task: act.refreshFlags.",
      '${openmrsSpaBase}/home/act-refresh-flags',
    ),
  },
  careCascade: {
    report: {
      _type: Type.String,
      _default: '9c6751ae-65fc-5f25-9aa6-8c65cb1dff68',
      _description:
        'The care cascade report, by uuid or name. The ACT home widget draws its rows, one per step, from their step and patients columns.',
    },
    reportUrl: link("Where the care cascade widget's link to the full report leads.", '${openmrsSpaBase}/reports'),
    steps: {
      _type: Type.Array,
      _elements: {
        _type: Type.Object,
        step: { _type: Type.String, _description: "The report row's step value." },
        label: { _type: Type.String, _description: 'What the widget calls it.' },
      },
      _default: [
        { step: 'Active', label: 'Active' },
        { step: 'Prescribed', label: 'Prescribed' },
        { step: 'Prescribed Prophylaxis', label: 'Prescribed' },
        { step: 'Initiated', label: 'Initiated' },
        { step: 'Initiated BPG', label: 'Initiated' },
        { step: 'Covered today', label: 'Covered today' },
        { step: 'Adherent (80%+)', label: 'Adherent (80%+)' },
        { step: 'Adherent', label: 'Adherent (80%+)' },
      ],
      _description:
        "The report's steps the widget draws, in this order, each by its step value and with the label it shows. A step the report does not return is left out. The report's Oral and BPG rows split Prescribed, so they are left out by default. The defaults also match the step names the report used before it had Covered today, so a distro on that report still draws its four steps.",
    },
  },
  registry: {
    report: {
      _type: Type.String,
      _default: 'f1a2b3c4-d5e6-7890-abcd-ef1234567890',
      _description: 'The RHD Patient List report, by uuid or name, whose rows the registry lists.',
    },
    showBpgColumns: {
      _type: Type.Boolean,
      _default: false,
      _description:
        "Show the report's bpg_status and adherence columns and a BPG status filter. Turn on once the report returns them.",
    },
  },
  waitingList: {
    report: {
      _type: Type.String,
      _default: '5b0f1c2e-9d3a-4c1b-8f6e-2a7d9e4b3c10',
      _description: 'The Procedural Waiting List report, by uuid or name, whose rows the waiting list shows.',
    },
  },
  dueForProphylaxis: {
    report: {
      _type: Type.String,
      _default: 'f3d8b672-a8a3-47a3-8a0b-dff01de6e3a8',
      _description:
        'The Due for Prophylaxis report, by uuid or name, whose rows the Due for prophylaxis page and widget list.',
    },
  },
  screenPositive: {
    report: {
      _type: Type.String,
      _default: 'e3b8f7a2-6c41-4d9e-8a57-1f0c2d4b9e63',
      _description:
        'The Screen Positive, Pending Confirmation report, by uuid or name, whose rows the screen positive list shows.',
    },
  },
  programmeReport: {
    report: {
      _type: Type.String,
      _default: 'c4a9e2d1-7b3f-4e58-9a16-2f0d8b5c7e31',
      _description:
        'The RHD Programme Report, by uuid or name, whose rows (one per primary care clinic) the Reports and Facility reports pages show.',
    },
  },
  cardiacTests: {
    echoForm: {
      _type: Type.UUID,
      _default: '88e54fb0-1243-3f7a-b925-f64648ca6635',
      _description: "The form the chart's Cardiac tests page opens from Add.",
    },
    echoEncounterType: {
      _type: Type.UUID,
      _default: '730f5ec2-7102-55d0-8602-2d792844f245',
      _description: "The encounter type of the echocardiograms the Cardiac tests page lists, the echo form's.",
    },
    concepts: {
      date: concept(
        'Date of Echocardiogram, the date a row shows; without one, the encounter date.',
        '911be530-9457-54be-8515-4bbcdb832ccb',
      ),
      mitralRegurgitation: concept(
        'Mitral Regurgitation, the Mitral regurgitation column.',
        'd6ab05e2-1ece-5f8f-893d-74739aa66ce5',
      ),
      mitralStenosis: concept(
        'Mitral stenosis severity, the Mitral stenosis column.',
        'ed209fc3-0138-516c-a0bd-bcd3b2697a87',
      ),
      aorticRegurgitation: concept(
        'Aortic Regurgitation, the Aortic regurgitation column.',
        '0bbc510f-1e95-5c74-bbe3-8896907fd6c1',
      ),
      aorticStenosis: concept('Aortic Stenosis, the Aortic stenosis column.', '7586c9a6-73db-5ab2-8f23-71a3cc4bae62'),
      ejectionFraction: concept(
        'Left Ventricular Ejection Fraction, the Left ventricular ejection fraction column, in %.',
        'ed630fda-8451-53c0-929e-40eafd9bca9b',
      ),
    },
    ecgForm: {
      _type: Type.UUID,
      _default: '3776bb8d-4741-3741-aeef-d5b760443569',
      _description: "The form the Cardiac tests page's Electrocardiograms card opens from Add.",
    },
    ecgEncounterType: {
      _type: Type.UUID,
      _default: '64c3f35f-a3ec-59d6-8178-0ca9f068cda8',
      _description: "The encounter type of the electrocardiograms the Cardiac tests page lists, the ECG form's.",
    },
    ecgConcepts: {
      date: concept(
        'Date of Electrocardiogram, the date a row shows; without one, the encounter date.',
        'a85d4e63-500f-5af9-8ebd-9e1db5ddc3ed',
      ),
      result: concept(
        'Electrocardiogram Result, the Result column, one answer per finding.',
        '1c5476e4-ff12-5fbd-b2ad-53f66f9006a0',
      ),
      otherFinding: concept(
        'Other Electrocardiogram Finding, the Other finding column.',
        '67d65827-eea5-57ac-ae8b-77f91d128063',
      ),
    },
  },
  prophylaxisPage: {
    bpgEncounterType: {
      _type: Type.UUID,
      _default: '04cf03db-3b8e-5020-84b0-50b06338767a',
      _description: "The encounter type of the BPG injections the chart's Prophylaxis page lists, the BPG form's.",
    },
    oralEncounterType: {
      _type: Type.UUID,
      _default: '55271793-ef37-58da-9d86-1d9092a5a809',
      _description: "The encounter type of the oral adherence entries the Prophylaxis page lists, the oral form's.",
    },
    concepts: {
      injectionDate: concept(
        'Date of Injection, the date a BPG row shows. A BPG visit without one was withheld, so it is not listed or counted as recorded today.',
        '183fb30e-b861-5b7c-806f-7118a40f2b51',
      ),
      doseGiven: concept(
        'Dose given, the BPG dose a row shows; an injection saved before the form asked it has none.',
        '6a52b6aa-2427-4fa2-93cb-18956f50c16a',
      ),
      facility: concept(
        'Facility, a location picked on the BPG form; without one, the encounter location.',
        '01e6dd39-b8ba-5b0a-bcd7-6b8d5973c1bc',
      ),
      lateReason: concept(
        'If injection(s) late, why?, the reasons a late injection tag names.',
        'f7cbfcdc-58bb-5e85-86ab-ffce26a08615',
      ),
      weeks: concept(
        'Weeks in Reporting Period, the period an oral row shows.',
        '75cd7e15-5f05-58d1-acb1-4a046eb1b437',
      ),
      adherence: concept(
        'Adherence Estimate, the percentage an oral row shows.',
        '8edff8dc-4af6-5d0f-bf1d-8e349c7a1b15',
      ),
    },
  },
  consultations: {
    form: {
      _type: Type.UUID,
      _default: '4b063fc7-996f-3001-8500-8940e201be8f',
      _description:
        "The form Start consultation opens, on the chart's Consultation visits page and the patient summary's Consultation visits card.",
    },
    encounterType: {
      _type: Type.UUID,
      _default: 'c2503561-c00d-5460-8157-43d594472b4a',
      _description: "The encounter type of the consultations the Consultation visits page and card read, the form's.",
    },
    concepts: {
      date: concept(
        'Date of Consultation Visit, the date a row shows; without one, the encounter date.',
        'c3edefd2-5777-5084-b01e-fd4ca0e40162',
      ),
      nyha: concept('NYHA Classification, the NYHA class column.', '2f51b894-383c-53bb-9997-583e9761d132'),
      prophylaxis: concept(
        'Secondary Antibiotic Prophylaxis, the prophylaxis plan column: each entry not stopped.',
        '668e0221-8b41-5669-9ad8-78e193d42494',
      ),
      cardiacMedication: concept(
        'Cardiac Medication: the latest consultation recording one says whether the patient is on warfarin.',
        '0734567e-4f0a-5090-9d74-b953921a30e6',
      ),
      dosing: concept(
        "Dosing (Consultation Visit), a medication entry's dose: the warfarin dose until an INR review records a new one.",
        '8879385e-d35e-50a3-a3d0-4333d95d4878',
      ),
      dateStopped: concept(
        'Date Stopped, which ends a prophylaxis or medication entry.',
        'd75edc42-3213-5a06-9228-4e5735b9594b',
      ),
      nextReviewAmount: concept(
        'Next Consultation Time Amount: with its period, after the encounter date, the next cardiology review.',
        'ba4b8a87-2ce8-559e-9a30-45504a9b6c1f',
      ),
      nextReviewPeriod: concept(
        'Next Consultation Time Period, answered Days, Weeks, Months or Years.',
        '1732AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      ),
    },
    periods: {
      _type: Type.Object,
      _default: {
        '1072AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': 'day',
        '1073AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': 'week',
        '1074AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': 'month',
        '1734AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA': 'year',
      },
      _description:
        "Each Next Consultation Time Period answer, by concept uuid, and its unit: day, week, month or year, as the flag 'RHD cardiology follow-up due' counts them.",
    },
    warfarin: {
      _type: Type.Array,
      _elements: { _type: Type.ConceptUuid },
      _default: ['5e97fe35-58df-4925-bba7-7c49d75268a1', '3c7f8916-3ab5-5678-83c5-be7c7bb1f5e7'],
      _description:
        "The Cardiac Medication answers that are warfarin (Warfarin, Acitrom), as the flags 'RHD INR target missing' and 'RHD INR review due' name them. A patient whose latest consultation recording a cardiac medication has one of them, not stopped, is on warfarin, and has INR reviews.",
    },
  },
  inr: {
    form: {
      _type: Type.UUID,
      _default: 'fe4848b2-a0b4-329f-a6a3-6ffc298e09a9',
      _description:
        "The form Record INR opens, on the chart's INR reviews page and the patient summary's INR review card.",
    },
    encounterType: {
      _type: Type.UUID,
      _default: 'b4bb88a3-9a04-5142-85bd-bb63c270f632',
      _description: "The encounter type of the INR reviews the INR reviews page and card read, the form's.",
    },
    concepts: {
      target: concept(
        "INR Target, answered as a range such as 2.0-3.0. The form also uses it for the group of each INR reading, which has members where the target has an answer. A reading's group may also hold its own target as a member, which then is that reading's target.",
        '0778ce12-ddba-5e22-b5fd-92424e8747b4',
      ),
      dateTested: concept(
        'Date Tested, the date of a reading; without one, the encounter date.',
        'be9041b1-3948-5de0-a8b1-974e84b95715',
      ),
      value: concept('INR Value, the INR of a reading.', '161482AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'),
      newDose: concept(
        'New Anticoagulant Dose, the warfarin dose a reading changes to.',
        'f27f6ed2-48db-5be7-91da-3e2483915462',
      ),
      nextDate: concept('Next INR Date, when the next INR is due.', '5096AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'),
    },
  },
  diagnosis: {
    encounterType: {
      _type: Type.UUID,
      _default: 'ffdc883f-f99f-496a-83f9-2c3c581e1af0',
      _description:
        "The encounter type of Patient Information, whose diagnosis the patient summary's Consultation visits card shows.",
    },
    concepts: {
      diagnosis: concept('Diagnosis, the group of one diagnosis.', '594b4495-36dc-52a6-9810-15a9e2e2dcb9'),
      category: concept(
        'Category at Diagnosis, shown when the diagnosis has no details.',
        '1a5aa050-661d-5e89-95d7-c1eba476df22',
      ),
      priority: concept(
        'Diagnosis Priority; a Secondary diagnosis is not shown.',
        '97c025b2-f42c-5c53-8aaa-0506c8dd3774',
      ),
      active: concept(
        'Diagnosis Active; a diagnosis answered No is not shown.',
        'b1b5d279-8013-5ae4-83a7-0f2bd9bc8457',
      ),
    },
    details: {
      _type: Type.Array,
      _elements: { _type: Type.ConceptUuid },
      _default: [
        'cfe17bb5-4a76-5f3a-9e1c-7b1e9b84a8e3',
        'd3f6e1a2-9c5b-5e84-8f2d-1a6c7b9e0d4f',
        'b7a2c4d8-5e91-5f3a-8c6d-2b9e4f7a1c0d',
        'e9f3a5c7-6b82-5d4e-9f1a-3c7d8e2b5f4a',
      ],
      _description:
        'The Diagnosis Details questions, one per category; their answers are the diagnosis shown, such as RHD C/RHD D.',
    },
    secondary: concept('The Diagnosis Priority answer Secondary.', 'af45fb2a-ed18-5beb-935e-8e4d92df2dac'),
    no: concept('The answer No, to Diagnosis Active.', '488b58ff-64f5-4f8a-8979-fa79940b1594'),
  },
  contact: {
    phone: {
      _type: Type.Array,
      _elements: { _type: Type.UUID },
      _default: ['542c6fd2-05ca-53e3-a4f5-cd23bc1abd8f', '14d4f066-15f5-102d-96e4-000c29c2a5d7'],
      _description:
        "The person attribute types the Contact card's Phone reads, the first the patient has: Primary Phone, which registration records, then Telephone Number.",
    },
    phoneOwner: {
      _type: Type.UUID,
      _default: 'ea3cb7ae-ffbe-5aee-8343-44977898f675',
      _description: "The person attribute type the Contact card's Phone owner reads.",
    },
    primaryCareClinic: {
      _type: Type.Array,
      _elements: { _type: Type.UUID },
      _default: ['695f2990-236f-5d7c-b8aa-ddbdb22400f4', '8d87236c-c2cc-11de-8d13-0010c6dffd0f'],
      _description:
        "The person attribute types the Contact card's Primary care clinic reads, the first the patient has: Primary Care Clinic, which registration records, then Health Center, which patients seeded before it carry.",
    },
    cardiacClinic: {
      _type: Type.UUID,
      _default: 'fe261119-2911-5b36-be40-8f9827826987',
      _description:
        "The person attribute type, a location, the Contact and Consultation visits cards' Cardiac clinic reads. Its tertiary care centre is that clinic, or the nearest location above it, tagged tertiaryTag.",
    },
    tertiaryTag: {
      _type: Type.String,
      _default: 'RHD Tertiary',
      _description: "The location tag that marks a tertiary care centre, the Contact card's Tertiary care centre.",
    },
  },
  bannerFlags: {
    cardiologyFollowUp: {
      _type: Type.UUID,
      _default: 'b1f7a2c0-0016-4a00-9000-000000000016',
      _description:
        'The flag RHD cardiology follow-up due, by uuid. While the patient has it, the banner shows Cardiology visit due, or overdue once the next review date has passed.',
    },
    inrReview: {
      _type: Type.UUID,
      _default: 'b1f7a2c0-0017-4a00-9000-000000000017',
      _description:
        'The flag RHD INR review due, by uuid. While the patient has it, the banner shows INR due, or overdue once the Next INR Date has passed.',
    },
  },
  nextSteps: {
    enabled: {
      _type: Type.Boolean,
      _default: true,
      _description:
        "Whether the patient summary shows Next steps for this visit, from ACT Core's /actcore/nextsteps. When false, the card is hidden and neither /actcore/nextsteps nor the form list is fetched.",
    },
  },
  prophylaxisCard: {
    bpgForm: {
      _type: Type.UUID,
      _default: '0119d2e6-e2e1-391c-9b88-d59a10b0780d',
      _description:
        "The form Record BPG opens, on the patient summary's Prophylaxis card and the chart's Prophylaxis page, to record a BPG injection.",
    },
    oralForm: {
      _type: Type.UUID,
      _default: 'ba29e982-ce18-302a-9fc4-d4b2c3983465',
      _description:
        "The form Record oral opens, on the patient summary's Prophylaxis card and the chart's Prophylaxis page, to record oral prophylaxis.",
    },
  },
  actIdentifierType: {
    _type: Type.UUID,
    _default: '240f85fa-46e1-540e-9234-2796c623f7ea',
    _description: "The identifier type ACT's patient search shows as the patient's ACT ID.",
  },
  visitType: {
    _type: Type.UUID,
    _default: 'bf86d5a7-9511-5c11-acb1-8f8718775cd5',
    _description: 'The visit type an ACT screen starts when it opens a form for a patient with no active visit.',
  },
  urgencyBands: {
    _type: Type.Array,
    _elements: {
      label: { _type: Type.String, _description: 'What the waiting list and its Urgency filter call the band.' },
      shortLabel: {
        _type: Type.String,
        _description: "What ACT home's waiting list widget calls the band; without one, it uses label.",
      },
      concept: { _type: Type.ConceptUuid, _description: 'The answer that records this band.' },
      deadlineDays: { _type: Type.Number, _description: 'Days allowed before a patient in this band is overdue.' },
    },
    _default: [
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
    _description:
      "Urgency bands for the procedural waiting list, most urgent first: ACT 2.0's three urgencies, which answer the RHD Consultation Visit's Urgency, with the days allowed before a recommendation is overdue. The four answers they replaced keep their old deadlines, for recommendations saved before, and every band sits in deadline order. A recommendation whose answer no band names keeps the answer's name, is not marked overdue and is listed after the bands.",
    _validators: [
      validator(
        (bands: Array<{ concept?: string; deadlineDays?: unknown }>) =>
          bands.every((band) => band.concept && typeof band.deadlineDays === 'number'),
        'Every urgency band needs a concept and a number of deadline days',
      ),
    ],
  },
};

export type EchoField =
  | 'date'
  | 'mitralRegurgitation'
  | 'mitralStenosis'
  | 'aorticRegurgitation'
  | 'aorticStenosis'
  | 'ejectionFraction';

export interface Config {
  clinicLocationTags: { cardiac: Array<string>; primaryCare: Array<string> };
  flagLists: {
    namePrefix: string;
    names: Array<string>;
    riskFlags: Array<string>;
    flagForms: Array<{ flag: string; form: string; concept: string }>;
  };
  quickActions: {
    registerPatientUrl: string;
    enterProphylaxisInFastDataEntry: boolean;
    enterProphylaxisUrl: string;
    prophylaxisForms: Array<{ label: string; url: string }>;
    findPatientInPanel: boolean;
    findPatientUrl: string;
  };
  dataClerkQuickActions: {
    facilityReportUrl: string;
  };
  adminLinks: { usersUrl: string; clinicsUrl: string; studiesUrl: string; refreshFlagsUrl: string };
  careCascade: { report: string; reportUrl: string; steps: Array<{ step: string; label: string }> };
  registry: { report: string; showBpgColumns: boolean };
  waitingList: { report: string };
  dueForProphylaxis: { report: string };
  screenPositive: { report: string };
  programmeReport: { report: string };
  cardiacTests: {
    echoForm: string;
    echoEncounterType: string;
    concepts: Record<EchoField, string>;
    ecgForm: string;
    ecgEncounterType: string;
    ecgConcepts: Record<'date' | 'result' | 'otherFinding', string>;
  };
  prophylaxisPage: {
    bpgEncounterType: string;
    oralEncounterType: string;
    concepts: Record<'injectionDate' | 'doseGiven' | 'facility' | 'lateReason' | 'weeks' | 'adherence', string>;
  };
  consultations: {
    form: string;
    encounterType: string;
    concepts: Record<
      | 'date'
      | 'nyha'
      | 'prophylaxis'
      | 'cardiacMedication'
      | 'dosing'
      | 'dateStopped'
      | 'nextReviewAmount'
      | 'nextReviewPeriod',
      string
    >;
    periods: Record<string, 'day' | 'week' | 'month' | 'year'>;
    warfarin: Array<string>;
  };
  inr: {
    form: string;
    encounterType: string;
    concepts: Record<'target' | 'dateTested' | 'value' | 'newDose' | 'nextDate', string>;
  };
  diagnosis: {
    encounterType: string;
    concepts: Record<'diagnosis' | 'category' | 'priority' | 'active', string>;
    details: Array<string>;
    secondary: string;
    no: string;
  };
  contact: {
    phone: Array<string>;
    phoneOwner: string;
    primaryCareClinic: Array<string>;
    cardiacClinic: string;
    tertiaryTag: string;
  };
  bannerFlags: { cardiologyFollowUp: string; inrReview: string };
  nextSteps: { enabled: boolean };
  prophylaxisCard: { bpgForm: string; oralForm: string };
  actIdentifierType: string;
  visitType: string;
  urgencyBands: Array<{ label?: string; shortLabel?: string; concept: string; deadlineDays: number }>;
}
