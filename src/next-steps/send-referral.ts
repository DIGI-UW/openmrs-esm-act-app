import { openmrsFetch, restBaseUrl } from '@openmrs/esm-framework';

/**
 * Records the patient's referral to a clinician as an encounter of the referral type at the session location. It names
 * no date, so the server stamps it and a fast client clock cannot put it in the future.
 */
export async function sendReferral(patientUuid: string, encounterType: string, location: string) {
  await openmrsFetch(`${restBaseUrl}/encounter`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { patient: patientUuid, encounterType, location },
  });
}
