import { getConfig } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { type ChartEncounter, fetchChartEncounters } from '../consultations/consultations.resource';
import { registerExpressionHelper } from '../forms-engine-registry';
import { toListedItems } from '../consultations/repeated-lists.resource';

type Consultations = Config['consultations'];

/** The name the RHD Consultation Visit's Current allergies calls in its calculate expression. */
export const allergiesHelper = 'actAllergies';

export interface Allergy {
  key: string;
  name: string;
  added: string;
  isPenicillin: boolean;
}

/**
 * The allergies any consultation records, each once, penicillin first, as the Consultation visits page lists them: one
 * an older consultation recorded stays until that consultation is edited.
 */
export function allergiesOf(encounters: Array<ChartEncounter>, consultations: Consultations): Array<Allergy> {
  const allergies = toListedItems(encounters, consultations.concepts, consultations.concepts.allergy).map((one) => ({
    key: one.key,
    name: one.name,
    added: one.added,
    isPenicillin: consultations.penicillinAllergyAnswers.includes(one.key) || /penicillin/i.test(one.name),
  }));
  return penicillinFirst(allergies);
}

const penicillinFirst = (allergies: Array<Allergy>) => [
  ...allergies.filter((one) => one.isPenicillin),
  ...allergies.filter((one) => !one.isPenicillin),
];

/** The allergies as one line, led by a capitalised warning when any is to penicillin. */
export function allergiesText(allergies: Array<Allergy>) {
  if (!allergies.length) {
    return 'Allergies not recorded';
  }
  const names = penicillinFirst(allergies)
    .map((one) => one.name)
    .join(', ');
  return allergies.some((one) => one.isPenicillin) ? `PENICILLIN ALLERGY: ${names}` : `Allergies: ${names}`;
}

/**
 * The patient's allergies as one line for the consultation form. A failure says so, as nothing read is not none.
 */
export async function fetchAllergiesText(patientUuid: string): Promise<string> {
  try {
    if (!patientUuid) {
      throw new Error('No patient');
    }
    const { consultations } = (await getConfig('@act-registry/esm-act-app')) as Config;
    const encounters = await fetchChartEncounters(patientUuid, consultations.encounterType);
    return allergiesText(allergiesOf(encounters, consultations));
  } catch {
    return 'Allergies unavailable';
  }
}

/** Lets the consultation form's Current allergies call actAllergies(patient.id). */
export const registerAllergies = () => registerExpressionHelper(allergiesHelper, fetchAllergiesText);
