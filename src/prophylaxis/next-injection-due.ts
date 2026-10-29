import dayjs from 'dayjs';
import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';
import { registerExpressionHelper } from '../forms-engine-registry';
import { type ProphylaxisSummary } from './prophylaxis.resource';

/** The name BPG Delivery's Next injection due calls in its calculate expression. */
export const nextInjectionDueHelper = 'actNextInjectionDue';

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
export const registerNextInjectionDue = () => registerExpressionHelper(nextInjectionDueHelper, nextInjectionDue);
