import { userHasAccess, useSession } from '@openmrs/esm-framework';
import { PRIVILEGE_ACT_HOME } from '../constants';

/**
 * Whether ACT home is the user's home, as for the clinician and the administrators. They hold Home's and the due
 * list's privileges only so they may give out the community clinician's and data clerk's roles, which OpenMRS
 * allows only to a user holding every privilege of the role.
 */
export function useHoldsActHome() {
  const { user } = useSession();
  return Boolean(user) && userHasAccess(PRIVILEGE_ACT_HOME, user);
}
