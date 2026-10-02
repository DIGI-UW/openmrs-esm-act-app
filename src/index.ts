import { defineConfigSchema, getAsyncLifecycle, getSyncLifecycle } from '@openmrs/esm-framework';
import { configSchema } from './config-schema';
import actHomeDashboardLinkComponent from './act-home/act-home-dashboard-link.component';
import registryDashboardLinkComponent from './registry/registry-dashboard-link.component';
import worklistsDashboardLinkComponent from './worklists/worklists-dashboard-link.component';
import waitingListDashboardLinkComponent from './waiting-list/waiting-list-dashboard-link.component';
import { createChartDashboardLink } from './chart-dashboard-link.component';
import { cardiacTestsDashboardMeta } from './cardiac-tests/cardiac-tests.meta';
import { prophylaxisPageDashboardMeta } from './prophylaxis-page/prophylaxis-page.meta';
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

export const prophylaxisCard = getAsyncLifecycle(() => import('./prophylaxis/prophylaxis-card.component'), options);

export const prophylaxisStatusTag = getAsyncLifecycle(
  () => import('./prophylaxis/prophylaxis-status-tag.component'),
  options,
);

export const prophylaxisPageDashboardLink = getSyncLifecycle(
  createChartDashboardLink(prophylaxisPageDashboardMeta),
  options,
);

export const prophylaxisPageDashboard = getAsyncLifecycle(
  () => import('./prophylaxis-page/prophylaxis-page.component'),
  options,
);

export const cardiacTestsDashboardLink = getSyncLifecycle(createChartDashboardLink(cardiacTestsDashboardMeta), options);

export const cardiacTestsDashboard = getAsyncLifecycle(
  () => import('./cardiac-tests/cardiac-tests.component'),
  options,
);

export const flagGapsWorkspace = getAsyncLifecycle(() => import('./flag-gaps/flag-gaps.workspace'), options);

export const actHomeDashboardLink = getSyncLifecycle(actHomeDashboardLinkComponent, options);

export const actHomeDashboard = getAsyncLifecycle(() => import('./act-home/act-home-dashboard.component'), options);

export const actHomeQuickActions = getAsyncLifecycle(() => import('./act-home/quick-actions.component'), options);

export const actHomeWorklists = getAsyncLifecycle(() => import('./act-home/worklist-tiles.component'), options);

export const actHomeWaitingList = getAsyncLifecycle(() => import('./act-home/waiting-list-summary.component'), options);

export const actHomeCareCascade = getAsyncLifecycle(() => import('./act-home/care-cascade.component'), options);

export const registryDashboardLink = getSyncLifecycle(registryDashboardLinkComponent, options);

export const registryDashboard = getAsyncLifecycle(() => import('./registry/registry.component'), options);

export const worklistsDashboardLink = getSyncLifecycle(worklistsDashboardLinkComponent, options);

export const worklistsDashboard = getAsyncLifecycle(() => import('./worklists/worklists.component'), options);

export const waitingListDashboardLink = getSyncLifecycle(waitingListDashboardLinkComponent, options);

export const waitingListDashboard = getAsyncLifecycle(() => import('./waiting-list/waiting-list.component'), options);

export const screenPositiveDashboardLink = getSyncLifecycle(screenPositiveDashboardLinkComponent, options);

export const screenPositiveDashboard = getAsyncLifecycle(
  () => import('./screen-positive/screen-positive.component'),
  options,
);
