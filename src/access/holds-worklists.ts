import { userHasAccess, useSession } from '@openmrs/esm-framework';
import { PRIVILEGE_WORKLISTS } from '../constants';

/** Whether the user has the worklists, whose tiles open the procedural waiting list and Diagnosis to confirm. */
export function useHoldsWorklists() {
  const { user } = useSession();
  return Boolean(user) && userHasAccess(PRIVILEGE_WORKLISTS, user);
}
