import dayjs from 'dayjs';
import { getGlobalStore, openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { type ProphylaxisSummary } from './prophylaxis.resource';

/** The name BPG Delivery's Next injection due calls in its calculate expression. */
export const nextInjectionDueHelper = 'actNextInjectionDue';

// The form engine's registry (`FormsStore` in @openmrs/esm-form-engine-lib). Whichever module asks for the store
// first creates it, so this starts it with the engine's own empty registry rather than only the helpers.
const formsEngineStore = 'forms-engine-store';

interface FormsEngineRegistry {
  controls: Array<unknown>;
  postSubmissionActions: Array<unknown>;
  expressionHelpers: Record<string, Function>;
  fieldValidators: Array<unknown>;
  fieldValueAdapters: Array<unknown>;
  dataSources: Array<unknown>;
  formSchemaTransformers: Array<unknown>;
}

/**
 * The Date of Injection plus the interval ACT Core reads from the patient's prescription, which is the next due date
 * the chart shows once the dose is saved. Null for an oral regimen, no prescription, or a summary that can't be read.
 */
export async function nextInjectionDue(patientUuid: string, injectionDate: Date | string): Promise<Date | null> {
  if (!patientUuid || !injectionDate) {
    return null;
  }
  try {
    const { data } = await openmrsFetch<ProphylaxisSummary>(
      `${restBaseUrl}/actcore/prophylaxis?patient=${patientUuid}`,
    );
    if (data?.type !== 'BPG' || !data.intervalDays) {
      return null;
    }
    return dayjs(injectionDate).startOf('day').add(data.intervalDays, 'day').toDate();
  } catch {
    return null;
  }
}

/** Lets a form's calculate expression call actNextInjectionDue(patient.id, date_of_service). */
export function registerNextInjectionDue() {
  getGlobalStore<FormsEngineRegistry>(formsEngineStore, {
    controls: [],
    postSubmissionActions: [],
    expressionHelpers: {},
    fieldValidators: [],
    fieldValueAdapters: [],
    dataSources: [],
    formSchemaTransformers: [],
  }).getState().expressionHelpers[nextInjectionDueHelper] = nextInjectionDue;
}
