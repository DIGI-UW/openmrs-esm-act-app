import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { DashboardExtension } from '@openmrs/esm-framework';
import { ScreenAccess } from '../access/screen-access.component';
import { actHomeDashboardMeta } from './act-home.meta';

export default function ActHomeDashboardLink() {
  return (
    <ScreenAccess screen="home">
      <BrowserRouter>
        <DashboardExtension
          path={actHomeDashboardMeta.name}
          title={actHomeDashboardMeta.title}
          basePath={`${window.spaBase}/home`}
        />
      </BrowserRouter>
    </ScreenAccess>
  );
}
