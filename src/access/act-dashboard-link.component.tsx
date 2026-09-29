import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { DashboardExtension } from '@openmrs/esm-framework';
import { type ActScreen } from '../config-schema';
import { ScreenAccess } from './screen-access.component';

/** An ACT screen's entry in the home app's left nav, shown only to users who may see that screen. */
export function ActDashboardLink({ screen, meta }: { screen: ActScreen; meta: { name: string; title: string } }) {
  return (
    <ScreenAccess screen={screen}>
      <BrowserRouter>
        <DashboardExtension path={meta.name} title={meta.title} basePath={`${window.spaBase}/home`} />
      </BrowserRouter>
    </ScreenAccess>
  );
}
