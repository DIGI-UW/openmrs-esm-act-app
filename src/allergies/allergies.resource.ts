import { getConfig, parseDate } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import {
  answersIn,
  answerText,
  answerUuid,
  type ChartEncounter,
  fetchChartEncounters,
  useChartEncounters,
} from '../consultations/consultations.resource';
import { registerControl, registerExpressionHelper } from '../forms-engine-registry';

/** The name the RHD Consultation Visit's Current allergies calls in its calculate expression. */
export const allergiesHelper = 'actAllergies';

/** The rendering the RHD Consultation Visit's Current allergies question names in the form JSON. */
export const currentAllergiesControl = 'act-current-allergies';

/** The line when the allergies cannot be read, as nothing read is not none. */
export const allergiesUnavailable = 'Allergies unavailable';

export type AllergyConfig = Pick<Config, 'consultations' | 'allergies'>;

export interface Allergy {
  key: string;
  name: string;
  added: string;
  isPenicillin: boolean;
  reactions: Array<string>;
  resolved: string | null;
  /** The latest record of the allergy, which decides it. */
  encounterUuid: string;
  form: string;
}

const time = (date: string) => parseDate(date).getTime();

const penicillinFirst = <T extends { isPenicillin: boolean }>(allergies: Array<T>) => [
  ...allergies.filter((one) => one.isPenicillin),
  ...allergies.filter((one) => !one.isPenicillin),
];

/**
 * The allergies the consultations and RHD Allergies record, each once, penicillin first. The latest record decides
 * if one is current or, with a Date Resolved, past; its date is the earliest Date Added, else record date.
 */
export function allergiesOf(
  consultationEncounters: Array<ChartEncounter>,
  allergyRecords: Array<ChartEncounter>,
  { consultations, allergies }: AllergyConfig,
): { current: Array<Allergy>; past: Array<Allergy> } {
  const c = consultations.concepts;
  const a = allergies.concepts;
  const oldestFirst = [
    ...consultationEncounters.map((encounter) => ({ encounter, form: consultations.form })),
    ...allergyRecords.map((encounter) => ({ encounter, form: allergies.form })),
  ].sort((x, y) => time(x.encounter.encounterDatetime) - time(y.encounter.encounterDatetime));
  const byKey = new Map<string, Allergy>();
  for (const { encounter, form } of oldestFirst) {
    for (const group of answersIn(encounter.obs, c.allergy)) {
      const [name] = answersIn(group.groupMembers, c.allergy);
      if (!name) {
        continue;
      }
      const text = (concept: string) => {
        const [one] = answersIn(group.groupMembers, concept);
        return one ? answerText(one.value) : '';
      };
      const key = answerUuid(name.value) || answerText(name.value);
      const recorded = text(c.dateAdded) || encounter.encounterDatetime;
      const earlier = byKey.get(key);
      const displayName = answerText(name.value);
      byKey.set(key, {
        key,
        name: displayName,
        added: earlier && time(earlier.added) < time(recorded) ? earlier.added : recorded,
        isPenicillin: consultations.penicillinAllergyAnswers.includes(key) || /penicillin/i.test(displayName),
        reactions: answersIn(group.groupMembers, a.reaction)
          .flatMap((reactions) => answersIn(reactions.groupMembers, a.reaction))
          .map((reaction) => answerText(reaction.value)),
        resolved: text(a.dateResolved) || null,
        encounterUuid: encounter.uuid,
        form,
      });
    }
  }
  const all = penicillinFirst([...byKey.values()].sort((x, y) => time(y.added) - time(x.added)));
  return { current: all.filter((one) => !one.resolved), past: all.filter((one) => one.resolved) };
}

/** The allergies as one line, led by a capitalised warning when any is to penicillin. */
export function allergiesText(allergies: Array<Pick<Allergy, 'name' | 'isPenicillin'>>) {
  if (!allergies.length) {
    return 'Allergies not recorded';
  }
  const names = penicillinFirst(allergies)
    .map((one) => one.name)
    .join(', ');
  return allergies.some((one) => one.isPenicillin) ? `PENICILLIN ALLERGY: ${names}` : `Allergies: ${names}`;
}

export function useAllergies(patientUuid: string | null, config: AllergyConfig) {
  const consultations = useChartEncounters(patientUuid, config.consultations.encounterType);
  const records = useChartEncounters(patientUuid, config.allergies.encounterType);
  return {
    ...allergiesOf(consultations.encounters, records.encounters, config),
    error: consultations.error ?? records.error,
    isLoading: consultations.isLoading || records.isLoading,
  };
}

export async function fetchAllergiesText(patientUuid: string): Promise<string> {
  try {
    if (!patientUuid) {
      throw new Error('No patient');
    }
    const config = (await getConfig('@act-registry/esm-act-app')) as Config;
    const [consultations, records] = await Promise.all([
      fetchChartEncounters(patientUuid, config.consultations.encounterType),
      fetchChartEncounters(patientUuid, config.allergies.encounterType),
    ]);
    return allergiesText(allergiesOf(consultations, records, config).current);
  } catch {
    return allergiesUnavailable;
  }
}

/** Lets the consultation form's Current allergies call actAllergies(patient.id) and render as the app's control. */
export const registerAllergies = () => {
  registerExpressionHelper(allergiesHelper, fetchAllergiesText);
  registerControl(currentAllergiesControl, () => import('./current-allergies.control'));
};
