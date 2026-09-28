import { defineConfigSchema, getAsyncLifecycle, getSyncLifecycle } from '@openmrs/esm-framework';
import { configSchema } from './config-schema';
import actHomeDashboardLinkComponent from './act-home/act-home-dashboard-link.component';

const moduleName = '@mherman22/esm-rhd-app';

const options = {
  featureName: 'rhd-flag-gaps',
  moduleName,
};

export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

export function startupApp() {
  defineConfigSchema(moduleName, configSchema);
}

export const flagGapsWorkspace = getAsyncLifecycle(() => import('./flag-gaps/flag-gaps.workspace'), options);

export const actHomeDashboardLink = getSyncLifecycle(actHomeDashboardLinkComponent, options);

export const actHomeDashboard = getAsyncLifecycle(() => import('./act-home/act-home-dashboard.component'), options);

export const actHomeQuickActions = getAsyncLifecycle(() => import('./act-home/quick-actions.component'), options);

export const actHomeWorklists = getAsyncLifecycle(() => import('./act-home/worklist-tiles.component'), options);

export const actHomeCareCascade = getAsyncLifecycle(() => import('./act-home/care-cascade.component'), options);
