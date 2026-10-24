import { Type, validators } from '@openmrs/esm-framework';
import { type WorklistTone } from './worklist.component';

export interface FlagWorklistConfig {
  flag: string;
  title: string;
  tone: WorklistTone;
  dueDateColumn?: string;
}

// Keep these markers: extraction reads them to give en.json the default titles as keys.
// t('Cardiology follow-up due', 'Cardiology follow-up due')
// t('Lost to follow-up', 'Lost to follow-up')
// t('RHD 30-day post-procedural follow-up due', 'RHD 30-day post-procedural follow-up due')
// t('RHD pregnancy outcome due', 'RHD pregnancy outcome due')
// t('Referred to a clinician', 'Referred to a clinician')
// t('INR review due', 'INR review due')
/** The worklists that list a flag's patients, by their extension's name in routes.json, with what each shows by default. */
export const flagWorklists: Record<string, FlagWorklistConfig> = {
  'act-worklist-cardiology-follow-up': {
    flag: 'RHD cardiology follow-up due',
    title: 'Cardiology follow-up due',
    tone: 'orange',
    dueDateColumn: 'next_consultation_date',
  },
  'act-worklist-lost-to-follow-up': { flag: 'RHD lost to follow-up', title: 'Lost to follow-up', tone: 'red' },
  'act-worklist-post-procedural-follow-up': {
    flag: 'RHD 30-day follow-up due',
    title: 'RHD 30-day post-procedural follow-up due',
    tone: 'orange',
  },
  'act-worklist-pregnancy-outcome': {
    flag: 'RHD delivery outcome overdue',
    title: 'RHD pregnancy outcome due',
    tone: 'orange',
  },
  'act-worklist-referred-to-clinician': {
    flag: 'RHD referred to a clinician',
    title: 'Referred to a clinician',
    tone: 'orange',
  },
  'act-worklist-inr-review': {
    flag: 'RHD INR review due',
    title: 'INR review due',
    tone: 'orange',
    dueDateColumn: 'next_inr_date',
  },
};

/** A flag worklist's config, which a deployment sets under its extension's name. */
export function flagWorklistConfigSchema(defaults: FlagWorklistConfig) {
  return {
    flag: {
      _type: Type.String,
      _default: defaults.flag,
      _description: 'The flag, by name, whose list this is. A flag that has no list in ACT Core hides the worklist.',
    },
    title: {
      _type: Type.String,
      _default: defaults.title,
      _description: "The worklist's name on its tile, translated with this text as its key.",
    },
    tone: {
      _type: Type.String,
      _default: defaults.tone,
      _description: 'The colour across the top of its tile: red for patients at risk, orange for care that is due.',
      _validators: [validators.oneOf(['red', 'orange'])],
    },
    dueDateColumn: {
      _type: Type.String,
      _default: defaults.dueDateColumn ?? '',
      _description:
        "The registry report's column holding the date the patient is due by, which says why they are on the list; without it, how long they have been on it.",
    },
  };
}
