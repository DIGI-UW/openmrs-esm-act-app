import { userHasAccess, useSession } from '@openmrs/esm-framework';
import { PRIVILEGE_ACT_HOME, PRIVILEGE_EDIT_USERS } from '../constants';

/** Whether the user works from ACT home and manages users; Home and the due list stay out of such a user's nav. */
export function useAdministersFromActHome() {
  const { user } = useSession();
  return Boolean(user) && userHasAccess([PRIVILEGE_ACT_HOME, PRIVILEGE_EDIT_USERS], user);
}
