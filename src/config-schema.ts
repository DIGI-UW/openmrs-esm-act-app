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
  _description: `Location tags that mark ${clinics}, used by the clinic filters.`,
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
  urgencyBands: {
    _type: Type.Array,
    _elements: {
      label: { _type: Type.String, _description: 'The name of the band.' },
      concept: { _type: Type.ConceptUuid, _description: 'The answer that records this band.' },
      deadlineDays: { _type: Type.Number, _description: 'Days allowed before a patient in this band is overdue.' },
    },
    _default: [
      { label: '1: Emergent', concept: '1fe15210-4490-58b0-a38c-bb0386e98482', deadlineDays: 1 },
      { label: '2: Urgent', concept: '33bf504a-15f2-5504-9bdc-ddded0b5eb00', deadlineDays: 60 },
      { label: '3: Elective', concept: '2666bf97-7400-57c7-b535-7903e22ced34', deadlineDays: 180 },
    ],
    _description: 'Urgency bands for the procedural waiting list, with their deadlines, as in ACT 2.0.',
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
  urgencyBands: Array<{ label: string; concept: string; deadlineDays: number }>;
}
