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
    enterProphylaxisUrl: link(
      'Where the Enter prophylaxis quick action on ACT home leads: the fast data entry app, whose forms the distro sets.',
      '${openmrsSpaBase}/forms',
    ),
    findPatientUrl: link('Where the Find a patient quick action on ACT home leads.', '${openmrsSpaBase}/search'),
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
      _elements: { _type: Type.String },
      _default: ['Active', 'Prescribed Prophylaxis', 'Initiated BPG', 'Adherent'],
      _description:
        "The report's steps the widget draws, by their step value, in this order. The report's Oral and BPG rows split Prescribed Prophylaxis, so they are left out by default.",
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

export type ActScreen = 'home' | 'registry' | 'waitingList' | 'screenPositive';

export interface Config {
  screenPrivileges: Record<ActScreen, string>;
  clinicLocationTags: { cardiac: Array<string>; primaryCare: Array<string> };
  flagLists: {
    namePrefix: string;
    names: Array<string>;
    riskFlags: Array<string>;
  };
  quickActions: { registerPatientUrl: string; enterProphylaxisUrl: string; findPatientUrl: string };
  careCascade: { report: string; reportUrl: string; steps: Array<string> };
  registry: { report: string; showBpgColumns: boolean };
  waitingList: { report: string };
  urgencyBands: Array<{ label: string; concept: string; deadlineDays: number }>;
}
