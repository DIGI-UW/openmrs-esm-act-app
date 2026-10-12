import { useSession } from '@openmrs/esm-framework';
import { useSessionClinicScope } from '../session-clinic';

export type ProgrammeScope =
  | { status: 'pending' }
  | { status: 'error' }
  | { status: 'ready'; params: Record<string, string> };

/**
 * The report's clinic parameter for the session location, by its clinic kind. At a location of neither kind,
 * Reports starts at All; Facility reports, which has no filters, stays at the location, never other clinics.
 */
export function useProgrammeScope(fixed: boolean): ProgrammeScope {
  const { sessionLocation } = useSession();
  const scope = useSessionClinicScope();
  if (scope.status !== 'ready') {
    return { status: scope.status };
  }
  if (fixed && !sessionLocation?.uuid) {
    return { status: 'error' };
  }
  if (scope.kind === 'cardiac') {
    return { status: 'ready', params: { cardiacClinic: sessionLocation.uuid } };
  }
  if (scope.kind === 'primaryCare' || fixed) {
    return { status: 'ready', params: { primaryCareClinic: sessionLocation.uuid } };
  }
  return { status: 'ready', params: {} };
}
