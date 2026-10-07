import { useSession } from '@openmrs/esm-framework';
import { useSessionClinicKind } from '../session-clinic';

export type ProgrammeScope =
  | { status: 'pending' }
  | { status: 'error' }
  | { status: 'ready'; params: Record<string, string> };

/**
 * The report's clinic parameter for the session location: its patients as a cardiac clinic, or as a primary
 * care clinic. At a location that is neither, Reports starts at every clinic, which its filters show as All;
 * Facility reports, which has no filters, stays at the location itself, so it never shows other clinics' numbers.
 */
export function useProgrammeScope(fixed: boolean): ProgrammeScope {
  const { sessionLocation } = useSession();
  const kind = useSessionClinicKind();
  if (kind === 'pending' || kind === 'error') {
    return { status: kind };
  }
  if (fixed && !sessionLocation?.uuid) {
    return { status: 'error' };
  }
  if (kind === 'cardiac') {
    return { status: 'ready', params: { cardiacClinic: sessionLocation.uuid } };
  }
  if (kind === 'primaryCare' || fixed) {
    return { status: 'ready', params: { primaryCareClinic: sessionLocation.uuid } };
  }
  return { status: 'ready', params: {} };
}
