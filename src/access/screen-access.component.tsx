import React from 'react';
import { userHasAccess, useSession } from '@openmrs/esm-framework';
import { type ActScreen } from '../config-schema';
import {
  PRIVILEGE_ACT_HOME,
  PRIVILEGE_REGISTRY,
  PRIVILEGE_SCREEN_POSITIVE,
  PRIVILEGE_WAITING_LIST,
  PRIVILEGE_WORKLISTS,
} from '../constants';

/** Each ACT screen's privilege, the same one its extensions declare in routes.json. */
export const screenPrivileges: Record<ActScreen, string> = {
  home: PRIVILEGE_ACT_HOME,
  registry: PRIVILEGE_REGISTRY,
  worklists: PRIVILEGE_WORKLISTS,
  waitingList: PRIVILEGE_WAITING_LIST,
  screenPositive: PRIVILEGE_SCREEN_POSITIVE,
};

/** Whether the signed-in user holds the ACT screen's privilege. */
export function useScreenAccess(screen: ActScreen) {
  const { user } = useSession();
  return Boolean(user) && userHasAccess(screenPrivileges[screen], user);
}

/** Renders an ACT screen, or its menu entry or widget, only for users who may see that screen. */
export function ScreenAccess({ screen, children }: { screen: ActScreen; children: React.ReactNode }) {
  return useScreenAccess(screen) ? <>{children}</> : null;
}
