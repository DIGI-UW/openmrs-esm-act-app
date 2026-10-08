import { createDashboard, defineConfigSchema, getAsyncLifecycle, getSyncLifecycle } from '@openmrs/esm-framework';
import { configSchema } from './config-schema';
import actHomeDashboardLinkComponent from './act-home/act-home-dashboard-link.component';
import registryDashboardLinkComponent from './registry/registry-dashboard-link.component';
import worklistsDashboardLinkComponent from './worklists/worklists-dashboard-link.component';
import waitingListDashboardLinkComponent from './waiting-list/waiting-list-dashboard-link.component';
import { cardiacTestsDashboardMeta } from './cardiac-tests/cardiac-tests.meta';
import { prophylaxisPageDashboardMeta } from './prophylaxis-page/prophylaxis-page.meta';
import screenPositiveDashboardLinkComponent from './screen-positive/screen-positive-dashboard-link.component';
import dueForProphylaxisDashboardLinkComponent from './due-for-prophylaxis/due-for-prophylaxis-dashboard-link.component';
import communityHomeDashboardLinkComponent from './community-home/community-home-dashboard-link.component';
import reportsDashboardLinkComponent from './programme-report/reports-dashboard-link.component';
import facilityReportsDashboardLinkComponent from './programme-report/facility-reports-dashboard-link.component';
import { trackActReturn } from './back-to-act/act-return';

const moduleName = '@mherman22/esm-act-app';

const options = {
  featureName: 'act',
  moduleName,
};

export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

export function startupApp() {
  defineConfigSchema(moduleName, configSchema);
  trackActReturn();
}

export const backToActLink = getAsyncLifecycle(() => import('./back-to-act/back-to-act-link.component'), options);

export const prophylaxisCard = getAsyncLifecycle(() => import('./prophylaxis/prophylaxis-card.component'), options);

export const prophylaxisStatusTag = getAsyncLifecycle(
  () => import('./prophylaxis/prophylaxis-status-tag.component'),
  options,
);

export const prophylaxisPageDashboardLink = getSyncLifecycle(createDashboard(prophylaxisPageDashboardMeta), options);

export const prophylaxisPageDashboard = getAsyncLifecycle(
  () => import('./prophylaxis-page/prophylaxis-page.component'),
  options,
);

export const cardiacTestsDashboardLink = getSyncLifecycle(createDashboard(cardiacTestsDashboardMeta), options);

export const cardiacTestsDashboard = getAsyncLifecycle(
  () => import('./cardiac-tests/cardiac-tests.component'),
  options,
);

export const flagGapsWorkspace = getAsyncLifecycle(() => import('./flag-gaps/flag-gaps.workspace'), options);

export const actHomeDashboardLink = getSyncLifecycle(actHomeDashboardLinkComponent, options);

export const actHomeDashboard = getAsyncLifecycle(() => import('./act-home/act-home-dashboard.component'), options);

export const actHomeQuickActions = getAsyncLifecycle(
  () =>
    import('./quick-actions/quick-actions.component').then(({ ActHomeQuickActions }) => ({
      default: ActHomeQuickActions,
    })),
  options,
);

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

export const reportsDashboardLink = getSyncLifecycle(reportsDashboardLinkComponent, options);

export const reportsDashboard = getAsyncLifecycle(() => import('./programme-report/reports.component'), options);

export const facilityReportsDashboardLink = getSyncLifecycle(facilityReportsDashboardLinkComponent, options);

export const facilityReportsDashboard = getAsyncLifecycle(
  () => import('./programme-report/facility-reports.component'),
  options,
);

export const studiesDashboardLink = getAsyncLifecycle(
  () => import('./studies/studies-dashboard-link.component'),
  options,
);

export const studiesDashboard = getAsyncLifecycle(() => import('./studies/studies.component'), options);

export const refreshFlagsDashboardLink = getAsyncLifecycle(
  () => import('./refresh-flags/refresh-flags-dashboard-link.component'),
  options,
);

export const refreshFlagsDashboard = getAsyncLifecycle(
  () => import('./refresh-flags/refresh-flags.component'),
  options,
);

export const dueForProphylaxisDashboardLink = getSyncLifecycle(dueForProphylaxisDashboardLinkComponent, options);

export const dueForProphylaxisDashboard = getAsyncLifecycle(
  () => import('./due-for-prophylaxis/due-for-prophylaxis.component'),
  options,
);

export const dueForProphylaxisWidget = getAsyncLifecycle(
  () => import('./due-for-prophylaxis/due-for-prophylaxis-widget.component'),
  options,
);

export const communityHomeDashboardLink = getSyncLifecycle(communityHomeDashboardLinkComponent, options);

export const adminNav = getAsyncLifecycle(() => import('./admin-nav/admin-nav.component'), options);

export const communityHomeDashboard = getAsyncLifecycle(
  () => import('./community-home/community-home-dashboard.component'),
  options,
);

const quickActions = () => import('./quick-actions/quick-actions.component');

export const communityHomeQuickActions = getAsyncLifecycle(
  () => quickActions().then(({ CommunityHomeQuickActions }) => ({ default: CommunityHomeQuickActions })),
  options,
);

const quickActionTiles = () => import('./quick-actions/quick-action-tiles.component');

export const registerPatientQuickAction = getAsyncLifecycle(
  () => quickActionTiles().then(({ RegisterPatientAction }) => ({ default: RegisterPatientAction })),
  options,
);

export const enterProphylaxisQuickAction = getAsyncLifecycle(
  () => quickActionTiles().then(({ EnterProphylaxisAction }) => ({ default: EnterProphylaxisAction })),
  options,
);

export const recordBpgQuickAction = getAsyncLifecycle(
  () => quickActionTiles().then(({ RecordBpgAction }) => ({ default: RecordBpgAction })),
  options,
);

export const recordOralQuickAction = getAsyncLifecycle(
  () => quickActionTiles().then(({ RecordOralAction }) => ({ default: RecordOralAction })),
  options,
);

export const findPatientQuickAction = getAsyncLifecycle(
  () => quickActionTiles().then(({ FindPatientAction }) => ({ default: FindPatientAction })),
  options,
);

export const facilityReportQuickAction = getAsyncLifecycle(
  () => quickActionTiles().then(({ FacilityReportAction }) => ({ default: FacilityReportAction })),
  options,
);
