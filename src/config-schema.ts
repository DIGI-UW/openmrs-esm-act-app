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
      _description: 'The worklist tiles show the lists of the flags whose names start with this, unless names is set.',
    },
    names: {
      _type: Type.Array,
      _elements: { _type: Type.String },
      _default: [],
      _description: 'The flags whose lists the worklist tiles show, by name. When set, namePrefix is not used.',
    },
    riskFlags: {
      _type: Type.Array,
      _elements: { _type: Type.String },
      _default: ['RHD prophylaxis overdue', 'RHD lost to follow-up', 'RHD no data for 5 months'],
      _description: 'The flags, by name, that mark a clinical risk. The lists of every other flag are missing data.',
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
        "Whether Enter prophylaxis on ACT home leads to fast data entry (prophylaxisForms, else enterProphylaxisUrl). When false, it opens ACT's patient search and the form in the patient's chart. It covers Enter prophylaxis only: Home's Record BPG injection and Record oral prophylaxis always open the patient search.",
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
      'Where the Facility report quick action on Home leads, for a user holding App: act.dataClerk.',
      '${openmrsSpaBase}/reports',
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
    echoForm: {
      _type: Type.UUID,
      _default: '88e54fb0-1243-3f7a-b925-f64648ca6635',
      _description: "The form the screen positive list's Enter echo result opens beside the list.",
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
        'Date of Injection, the date a BPG row shows; without one, the encounter date.',
        '183fb30e-b861-5b7c-806f-7118a40f2b51',
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
  careCascade: { report: string; reportUrl: string; steps: Array<{ step: string; label: string }> };
  registry: { report: string; showBpgColumns: boolean };
  waitingList: { report: string };
  dueForProphylaxis: { report: string };
  screenPositive: { report: string; echoForm: string };
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
    concepts: Record<'injectionDate' | 'facility' | 'lateReason' | 'weeks' | 'adherence', string>;
  };
  prophylaxisCard: { bpgForm: string; oralForm: string };
  actIdentifierType: string;
  visitType: string;
  urgencyBands: Array<{ label?: string; shortLabel?: string; concept: string; deadlineDays: number }>;
}
