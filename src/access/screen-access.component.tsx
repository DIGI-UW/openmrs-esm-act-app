import React from 'react';
import { userHasAccess, useSession } from '@openmrs/esm-framework';
import { type ActAction, actionPrivileges, type ActScreen, screenPrivileges } from './privileges';

/** Whether the signed-in user holds the ACT screen's privilege. */
export function useScreenAccess(screen: ActScreen) {
  const { user } = useSession();
  return Boolean(user) && userHasAccess(screenPrivileges[screen], user);
}

/** Renders an ACT screen, or its menu entry or widget, only for users who may see that screen. */
export function ScreenAccess({ screen, children }: { screen: ActScreen; children: React.ReactNode }) {
  return useScreenAccess(screen) ? <>{children}</> : null;
}

/** Whether the signed-in user holds the ACT action's privilege. */
export function useActionAccess(action: ActAction) {
  const { user } = useSession();
  return Boolean(user) && userHasAccess(actionPrivileges[action], user);
}

/** Renders an ACT action, such as a button, only for users who may take it. */
export function ActionAccess({ action, children }: { action: ActAction; children: React.ReactNode }) {
  return useActionAccess(action) ? <>{children}</> : null;
}
