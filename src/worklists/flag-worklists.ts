import { Type, validators } from '@openmrs/esm-framework';
import { type WorklistTone } from './worklist.component';

export interface FlagWorklistConfig {
  flag: string;
  title: string;
  tone: WorklistTone;
  dueDateColumn?: string;
}

// Keep these markers: extraction reads them to give en.json the default titles as keys.
// t('cardiologyFollowUpDue', 'Cardiology follow-up due')
// t('lostToFollowUp', 'Lost to follow-up')
// t('postProceduralFollowUpDue', 'RHD 30-day post-procedural follow-up due')
// t('pregnancyOutcomeDue', 'RHD pregnancy outcome due')
// t('referredToAClinician', 'Referred to a clinician')
// t('inrReviewDue', 'INR review due')
/** The worklists that list a flag's patients, by their extension's name in routes.json, with what each shows by default. */
export const flagWorklists: Record<string, FlagWorklistConfig> = {
  'act-worklist-cardiology-follow-up': {
    flag: 'RHD cardiology follow-up due',
    title: 'cardiologyFollowUpDue',
    tone: 'orange',
    dueDateColumn: 'next_consultation_date',
  },
  'act-worklist-lost-to-follow-up': { flag: 'RHD lost to follow-up', title: 'lostToFollowUp', tone: 'red' },
  'act-worklist-post-procedural-follow-up': {
    flag: 'RHD 30-day follow-up due',
    title: 'postProceduralFollowUpDue',
    tone: 'orange',
  },
  'act-worklist-pregnancy-outcome': {
    flag: 'RHD delivery outcome overdue',
    title: 'pregnancyOutcomeDue',
    tone: 'orange',
  },
  'act-worklist-referred-to-clinician': {
    flag: 'RHD referred to a clinician',
    title: 'referredToAClinician',
    tone: 'orange',
  },
  'act-worklist-inr-review': {
    flag: 'RHD INR review due',
    title: 'inrReviewDue',
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
      _description: "The worklist's name on its tile: a translation key, or text shown as written.",
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
