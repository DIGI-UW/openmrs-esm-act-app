import { userHasAccess, useSession } from '@openmrs/esm-framework';
import { PRIVILEGE_ACT_HOME } from '../constants';

/**
 * Whether ACT home is the user's home, as for the clinicians and the administrators. Such a user may also hold Home's
 * or the due list's privilege, as an administrator holds both to give out the data clerk's role.
 */
export function useHoldsActHome() {
  const { user } = useSession();
  return Boolean(user) && userHasAccess(PRIVILEGE_ACT_HOME, user);
}
