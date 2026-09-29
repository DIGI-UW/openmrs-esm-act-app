import React from 'react';
import { useConfig, userHasAccess, useSession } from '@openmrs/esm-framework';
import { type ActScreen, type Config } from '../config-schema';

/** Whether the signed-in user holds the privilege configured for the ACT screen. */
export function useScreenAccess(screen: ActScreen) {
  const { screenPrivileges } = useConfig<Config>();
  const { user } = useSession();
  return Boolean(user) && userHasAccess(screenPrivileges[screen], user);
}

/** Renders an ACT screen, or its menu entry or widget, only for users who may see that screen. */
export function ScreenAccess({ screen, children }: { screen: ActScreen; children: React.ReactNode }) {
  return useScreenAccess(screen) ? <>{children}</> : null;
}
