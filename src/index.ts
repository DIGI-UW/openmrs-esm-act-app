import { defineConfigSchema, getAsyncLifecycle, getSyncLifecycle } from '@openmrs/esm-framework';
import { configSchema } from './config-schema';
import actHomeDashboardLinkComponent from './act-home/act-home-dashboard-link.component';
import registryDashboardLinkComponent from './registry/registry-dashboard-link.component';
import waitingListDashboardLinkComponent from './waiting-list/waiting-list-dashboard-link.component';
import screenPositiveDashboardLinkComponent from './screen-positive/screen-positive-dashboard-link.component';

const moduleName = '@mherman22/esm-act-app';

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

export const actHomeWaitingList = getAsyncLifecycle(() => import('./act-home/waiting-list-summary.component'), options);

export const actHomeCareCascade = getAsyncLifecycle(() => import('./act-home/care-cascade.component'), options);

export const registryDashboardLink = getSyncLifecycle(registryDashboardLinkComponent, options);

export const registryDashboard = getAsyncLifecycle(() => import('./registry/registry.component'), options);

export const waitingListDashboardLink = getSyncLifecycle(waitingListDashboardLinkComponent, options);

export const waitingListDashboard = getAsyncLifecycle(() => import('./waiting-list/waiting-list.component'), options);

export const waitingListOpenForm = getAsyncLifecycle(
  () => import('./waiting-list/open-pending-form.component'),
  options,
);

export const screenPositiveDashboardLink = getSyncLifecycle(screenPositiveDashboardLinkComponent, options);

export const screenPositiveDashboard = getAsyncLifecycle(
  () => import('./screen-positive/screen-positive.component'),
  options,
);
