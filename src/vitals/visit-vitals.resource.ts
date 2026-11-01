import { getConfig, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { registerExpressionHelper } from '../forms-engine-registry';

type Vital = Config['consultations']['vitals'][number];

/** The name the RHD Consultation Visit's Vitals at this visit calls in its calculate expression. */
export const visitVitalsHelper = 'actVisitVitals';

/** What the consultation form shows, and what its Record vitals button looks for, when the visit has none. */
export const vitalsNotRecorded = 'Vitals not recorded at this visit';

export interface VisitObs {
  concept: { uuid: string };
  value: unknown;
  obsDatetime: string;
  voided?: boolean;
}

interface VisitEncounters {
  encounters?: Array<{ voided?: boolean; obs?: Array<VisitObs> }>;
}

/**
 * The visit's vitals as one line, in the configured order, each the latest recorded: a nurse who records them twice
 * corrects the first. Blood pressure shows its two values as one, with a dash for the one not recorded.
 */
export function vitalsText(obs: Array<VisitObs>, vitals: Array<Vital>) {
  const latest = new Map<string, VisitObs>();
  obs
    .filter((one) => !one.voided)
    .forEach((one) => {
      const kept = latest.get(one.concept.uuid);
      if (!kept || one.obsDatetime > kept.obsDatetime) {
        latest.set(one.concept.uuid, one);
      }
    });
  const shown = vitals
    .filter((vital) => vital.concepts.some((concept) => latest.has(concept)))
    .map(
      (vital) =>
        `${vital.label} ${vital.concepts.map((concept) => latest.get(concept)?.value ?? '–').join('/')} ${vital.unit}`,
    );
  return shown.length ? `Vitals at this visit: ${shown.join(', ')}` : vitalsNotRecorded;
}

/**
 * The vitals the Vitals & Biometrics form recorded in the consultation's visit, as one line for the consultation form.
 * A consultation outside a visit has none; a failure says so, as nothing read is not none.
 */
export async function fetchVisitVitalsText(patientUuid: string, visitUuid: string): Promise<string> {
  try {
    if (!patientUuid) {
      throw new Error('No patient');
    }
    if (!visitUuid) {
      return vitalsNotRecorded;
    }
    const { consultations } = (await getConfig('@act-registry/esm-act-app')) as Config;
    const { data } = await openmrsFetch<VisitEncounters>(
      `${restBaseUrl}/visit/${visitUuid}?v=custom:(encounters:(voided,obs:(concept:(uuid),value,obsDatetime,voided)))`,
    );
    const obs = (data?.encounters ?? []).filter((one) => !one.voided).flatMap((one) => one.obs ?? []);
    return vitalsText(obs, consultations.vitals);
  } catch {
    return 'Vitals unavailable';
  }
}

/** Lets the consultation form's Vitals at this visit call actVisitVitals(patient.id, visit.uuid). */
export const registerVisitVitals = () => registerExpressionHelper(visitVitalsHelper, fetchVisitVitalsText);
