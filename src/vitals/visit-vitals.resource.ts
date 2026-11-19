import useSWR from 'swr';
import { getConfig, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { type Config } from '../config-schema';
import { registerControl, registerExpressionHelper } from '../forms-engine-registry';

type Vital = Config['consultations']['vitals'][number];

/** The name the RHD Consultation Visit's Vitals at this visit calls in its calculate expression. */
export const visitVitalsHelper = 'actVisitVitals';

/** What the consultation form shows, and what its Record vitals button looks for, when the visit has none. */
export const vitalsNotRecorded = 'Vitals not recorded at this visit';

/** What the consultation form shows when the visit could not be read; its control replaces it once a read succeeds. */
export const vitalsUnavailable = 'Vitals unavailable';

/** The rendering the consultation form gives Vitals at this visit, so it updates when vitals are recorded. */
export const visitVitalsControl = 'act-visit-vitals';

const visitEncountersUrl = (visitUuid: string) =>
  `${restBaseUrl}/visit/${visitUuid}?v=custom:(encounters:(voided,obs:(concept:(uuid),value,obsDatetime,voided)))`;

const consultationVisits = new Map<string, Map<string | undefined, string>>();

/** Matched by the line the form shows, as another form for the patient may have run the helper since; else the latest. */
export const consultationVisitUuid = (patientUuid: string, text: string) => {
  const latestFirst = [...(consultationVisits.get(patientUuid) ?? [])].reverse();
  return (latestFirst.find(([, read]) => read === text) ?? latestFirst[0])?.[0];
};

const remember = (patientUuid: string, visitUuid: string | undefined, text: string) => {
  const read = consultationVisits.get(patientUuid) ?? new Map<string | undefined, string>();
  read.delete(visitUuid);
  consultationVisits.set(patientUuid, read.set(visitUuid, text));
  return text;
};

const visitObs = (data: VisitEncounters | undefined) =>
  (data?.encounters ?? []).filter((one) => !one.voided).flatMap((one) => one.obs ?? []);

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
      return remember(patientUuid, visitUuid, vitalsNotRecorded);
    }
    const { consultations } = (await getConfig('@act-registry/esm-act-app')) as Config;
    const { data } = await openmrsFetch<VisitEncounters>(visitEncountersUrl(visitUuid));
    return remember(patientUuid, visitUuid, vitalsText(visitObs(data), consultations.vitals));
  } catch {
    return patientUuid ? remember(patientUuid, visitUuid, vitalsUnavailable) : vitalsUnavailable;
  }
}

/** The visit's vitals as the consultation form shows them, re-read when the stock vitals form saves; none without a visit. */
export function useVisitVitals(visitUuid: string | undefined, vitals: Array<Vital>) {
  const { data } = useSWR(visitUuid ? visitEncountersUrl(visitUuid) : null, (url: string) =>
    openmrsFetch<VisitEncounters>(url).then(({ data }) => data),
  );
  return data ? vitalsText(visitObs(data), vitals) : null;
}

/** Lets the consultation form's Vitals at this visit call actVisitVitals(patient.id, visit.uuid) and render as the app's control. */
export const registerVisitVitals = () => {
  registerExpressionHelper(visitVitalsHelper, fetchVisitVitalsText);
  registerControl(visitVitalsControl, () => import('./visit-vitals.control'));
};
