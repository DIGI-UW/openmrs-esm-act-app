import { Type, validator } from '@openmrs/esm-framework';

const screenPrivilege = (screen: string) => ({
  _type: Type.String,
  _default: 'View Patient Flags',
  _description: `The privilege a user needs to see ${screen}, its menu entry and its widgets.`,
});

const locationTags = (clinics: string, defaultTags: Array<string>) => ({
  _type: Type.Array,
  _elements: { _type: Type.String },
  _default: defaultTags,
  _description: `Location tags that mark ${clinics}.`,
});

const link = (description: string, defaultUrl: string) => ({
  _type: Type.String,
  _default: defaultUrl,
  _description: description,
});

export const configSchema = {
  screenPrivileges: {
    home: screenPrivilege('the ACT home page'),
    registry: screenPrivilege('the registry list'),
    worklists: screenPrivilege('the worklists page'),
    waitingList: screenPrivilege('the procedural waiting list'),
    screenPositive: screenPrivilege('the screen positive, pending confirmation page'),
  },
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
      _default: ['RHD prophylaxis overdue', 'RHD lost to follow-up'],
      _description: 'The flags, by name, that mark a clinical risk. The lists of every other flag are missing data.',
    },
  },
  quickActions: {
    registerPatientUrl: link(
      'Where the Register patient quick action on ACT home leads.',
      '${openmrsSpaBase}/patient-registration',
    ),
    enterProphylaxisInFastDataEntry: {
      _type: Type.Boolean,
      _default: false,
      _description:
        "Whether Enter prophylaxis on ACT home leads to fast data entry (prophylaxisForms, else enterProphylaxisUrl). When false, it opens ACT's patient search and the form in the patient's chart.",
    },
    enterProphylaxisUrl: link(
      'Where the Enter prophylaxis quick action on ACT home leads when prophylaxisForms is empty: the fast data entry app.',
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
        'The choices the Enter prophylaxis quick action offers, as ACT 2.0 offered BPG and oral prophylaxis; by default the RHD BPG Delivery and RHD Oral Adherence forms in fast data entry. When empty, Enter prophylaxis leads to enterProphylaxisUrl.',
    },
    findPatientInPanel: {
      _type: Type.Boolean,
      _default: true,
      _description:
        "Whether Find a patient on ACT home opens ACT's patient search over the page. When false, it leads to findPatientUrl.",
    },
    findPatientUrl: link(
      'Where the Find a patient quick action on ACT home leads. The empty query keeps the search page loading when it is refreshed: the patient search app of 11.1.1-pre fails on a /search page load without one.',
      '${openmrsSpaBase}/search?query=',
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
        { step: 'Prescribed Prophylaxis', label: 'Prescribed' },
        { step: 'Initiated BPG', label: 'Initiated' },
        { step: 'Covered today', label: 'Covered today' },
        { step: 'Adherent', label: 'Adherent (80%+)' },
      ],
      _description:
        "The report's steps the widget draws, in this order, each by its step value and with the label it shows. A step the report does not return is left out. The report's Oral and BPG rows split Prescribed Prophylaxis, so they are left out by default.",
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
  screenPositive: {
    report: {
      _type: Type.String,
      _default: 'e3b8f7a2-6c41-4d9e-8a57-1f0c2d4b9e63',
      _description:
        'The Screen Positive, Pending Confirmation report, by uuid or name, whose rows the screen positive list shows.',
    },
  },
  prophylaxisCard: {
    bpgForm: {
      _type: Type.UUID,
      _default: '0119d2e6-e2e1-391c-9b88-d59a10b0780d',
      _description: "The form the patient summary's Prophylaxis card opens to record a BPG injection.",
    },
    oralForm: {
      _type: Type.UUID,
      _default: 'ba29e982-ce18-302a-9fc4-d4b2c3983465',
      _description: "The form the patient summary's Prophylaxis card opens to record oral prophylaxis.",
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
      label: { _type: Type.String, _description: 'The name of the band.' },
      concept: { _type: Type.ConceptUuid, _description: 'The answer that records this band.' },
      deadlineDays: { _type: Type.Number, _description: 'Days allowed before a patient in this band is overdue.' },
    },
    _default: [
      { label: '1 - within 1 week', concept: '406285f2-be72-5594-8664-c8568ad9bc88', deadlineDays: 7 },
      { label: '2 - within 1 month', concept: '82c5209b-c183-5bc9-941c-890eba821a44', deadlineDays: 30 },
      { label: '3 - within 3 months', concept: '925610f9-1c3c-5396-880f-02a5fe309d53', deadlineDays: 90 },
      { label: '4 - within 6 months', concept: '57e3873e-018e-5ed6-b7d4-5f73ef464cbd', deadlineDays: 180 },
    ],
    _description:
      "Urgency bands for the procedural waiting list, most urgent first: the RHD Consultation Visit's Urgency answers, with the days allowed before a recommendation is overdue.",
    _validators: [
      validator(
        (bands: Array<{ concept?: string; deadlineDays?: unknown }>) =>
          bands.every((band) => band.concept && typeof band.deadlineDays === 'number'),
        'Every urgency band needs a concept and a number of deadline days',
      ),
    ],
  },
};

export type ActScreen = 'home' | 'registry' | 'worklists' | 'waitingList' | 'screenPositive';

export interface Config {
  screenPrivileges: Record<ActScreen, string>;
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
  careCascade: { report: string; reportUrl: string; steps: Array<{ step: string; label: string }> };
  registry: { report: string; showBpgColumns: boolean };
  waitingList: { report: string };
  screenPositive: { report: string };
  prophylaxisCard: { bpgForm: string; oralForm: string };
  actIdentifierType: string;
  visitType: string;
  urgencyBands: Array<{ label: string; concept: string; deadlineDays: number }>;
}
