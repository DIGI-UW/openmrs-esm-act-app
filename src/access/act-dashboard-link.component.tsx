import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { DashboardExtension } from '@openmrs/esm-framework';

/** An ACT screen's entry in the home app's left nav; its extension declares the screen's privilege. */
export function ActDashboardLink({ meta }: { meta: { name: string; title: string } }) {
  return (
    <BrowserRouter>
      <DashboardExtension path={meta.name} title={meta.title} basePath={`${window.spaBase}/home`} />
    </BrowserRouter>
  );
}
