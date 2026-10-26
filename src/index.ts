import {
  createDashboard,
  defineConfigSchema,
  defineExtensionConfigSchema,
  getAsyncLifecycle,
  getSyncLifecycle,
} from '@openmrs/esm-framework';
import { configSchema } from './config-schema';
import actHomeDashboardLinkComponent from './act-home/act-home-dashboard-link.component';
import registryDashboardLinkComponent from './registry/registry-dashboard-link.component';
import worklistsDashboardLinkComponent from './worklists/worklists-dashboard-link.component';
import waitingListDashboardLinkComponent from './waiting-list/waiting-list-dashboard-link.component';
import { cardiacTestsDashboardMeta } from './cardiac-tests/cardiac-tests.meta';
import { consultationsDashboardMeta } from './consultations/consultations.meta';
import { prophylaxisPageDashboardMeta } from './prophylaxis-page/prophylaxis-page.meta';
import { researchPageDashboardMeta } from './research/research-page.meta';
import screenPositiveDashboardLinkComponent from './screen-positive/screen-positive-dashboard-link.component';
import dueForProphylaxisDashboardLinkComponent from './due-for-prophylaxis/due-for-prophylaxis-dashboard-link.component';
import patientsOnProphylaxisDashboardLinkComponent from './enter-prophylaxis/patients-on-prophylaxis-dashboard-link.component';
import communityHomeDashboardLinkComponent from './community-home/community-home-dashboard-link.component';
import reportsDashboardLinkComponent from './programme-report/reports-dashboard-link.component';
import reportViewDashboardLinkComponent from './report-view/report-view-dashboard-link.component';
import facilityReportsDashboardLinkComponent from './programme-report/facility-reports-dashboard-link.component';
import instanceAdminDashboardLinkComponent from './instance-admin/instance-admin-dashboard-link.component';
import scanPatientCardDashboardLinkComponent from './scan-patient-card/scan-patient-card-dashboard-link.component';
import { trackActReturn } from './back-to-act/act-return';
import { registerNextInjectionDue } from './prophylaxis/next-injection-due';
import { flagWorklistConfigSchema, flagWorklists } from './worklists/flag-worklists';

const moduleName = '@act-registry/esm-act-app';

const options = {
  featureName: 'act',
  moduleName,
};

export const importTranslation = require.context('../translations', false, /.json$/, 'lazy');

export function startupApp() {
  defineConfigSchema(moduleName, configSchema);
  Object.entries(flagWorklists).forEach(([name, defaults]) =>
    defineExtensionConfigSchema(name, flagWorklistConfigSchema(defaults)),
  );
  trackActReturn();
  registerNextInjectionDue();
}

export const backToActLink = getAsyncLifecycle(() => import('./back-to-act/back-to-act-link.component'), options);

export const sessionTimeout = getAsyncLifecycle(() => import('./session-timeout/session-timeout.component'), options);

export const nextStepsCard = getAsyncLifecycle(() => import('./next-steps/next-steps-card.component'), options);
export const prophylaxisCard = getAsyncLifecycle(() => import('./prophylaxis/prophylaxis-card.component'), options);

export const updatePatientStatusButton = getAsyncLifecycle(
  () => import('./update-patient-status/update-patient-status-button.component'),
  options,
);

export const scanPatientCardDashboardLink = getSyncLifecycle(scanPatientCardDashboardLinkComponent, options);

export const scanPatientCardDashboard = getAsyncLifecycle(
  () => import('./scan-patient-card/scan-patient-card.component'),
  options,
);

export const patientStatusFlags = getAsyncLifecycle(
  () => import('./patient-status/patient-status-flags.component'),
  options,
);

export const prophylaxisPageDashboardLink = getSyncLifecycle(createDashboard(prophylaxisPageDashboardMeta), options);

export const prophylaxisPageDashboard = getAsyncLifecycle(
  () => import('./prophylaxis-page/prophylaxis-page.component'),
  options,
);

export const researchPageDashboardLink = getSyncLifecycle(createDashboard(researchPageDashboardMeta), options);

export const researchPageDashboard = getAsyncLifecycle(() => import('./research/research-page.component'), options);

export const consultationsDashboardLink = getSyncLifecycle(createDashboard(consultationsDashboardMeta), options);

export const consultationsDashboard = getAsyncLifecycle(
  () => import('./consultations/consultations.component'),
  options,
);

export const inrReviewsDashboardLink = getAsyncLifecycle(() => import('./inr/inr-dashboard-link.component'), options);

export const inrReviewsDashboard = getAsyncLifecycle(() => import('./inr/inr-reviews.component'), options);

export const consultationCard = getAsyncLifecycle(() => import('./consultations/consultation-card.component'), options);

export const inrStatusFlag = getAsyncLifecycle(() => import('./inr/inr-status-flag.component'), options);

export const clinicalFlags = getAsyncLifecycle(() => import('./clinical-flags/clinical-flags.component'), options);

export const inrCard = getAsyncLifecycle(() => import('./inr/inr-card.component'), options);

export const contactCard = getAsyncLifecycle(() => import('./contact/contact-card.component'), options);

export const cliniciansOnlyNote = getAsyncLifecycle(
  () => import('./chart-note/clinicians-only-note.component'),
  options,
);

export const cardiacTestsDashboardLink = getSyncLifecycle(createDashboard(cardiacTestsDashboardMeta), options);

export const cardiacTestsDashboard = getAsyncLifecycle(
  () => import('./cardiac-tests/cardiac-tests.component'),
  options,
);

export const updatePatientStatusWorkspace = getAsyncLifecycle(
  () => import('./update-patient-status/update-patient-status.workspace'),
  options,
);

export const updateProphylaxisWorkspace = getAsyncLifecycle(
  () => import('./prophylaxis/update-prophylaxis.workspace'),
  options,
);

export const flagGapsWorkspace = getAsyncLifecycle(() => import('./flag-gaps/flag-gaps.workspace'), options);

export const enrollmentWorkspace = getAsyncLifecycle(() => import('./research/enrollment.workspace'), options);

export const studyFormWorkspace = getAsyncLifecycle(() => import('./studies/study-form.workspace'), options);

export const userFormWorkspace = getAsyncLifecycle(() => import('./users/user-form.workspace'), options);

export const resetPasswordWorkspace = getAsyncLifecycle(() => import('./users/reset-password.workspace'), options);

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

export const actHomeOverdueConsultation = getAsyncLifecycle(
  () => import('./act-home/overdue-consultation.component'),
  options,
);

export const actHomeCareCascade = getAsyncLifecycle(() => import('./act-home/care-cascade.component'), options);

export const registryDashboardLink = getSyncLifecycle(registryDashboardLinkComponent, options);

export const registryDashboard = getAsyncLifecycle(() => import('./registry/registry.component'), options);

export const worklistsDashboardLink = getSyncLifecycle(worklistsDashboardLinkComponent, options);

export const worklistsDashboard = getAsyncLifecycle(() => import('./worklists/worklists.component'), options);

export const dueForProphylaxisWorklist = getAsyncLifecycle(
  () => import('./worklists/due-for-prophylaxis-worklist.component'),
  options,
);

export const confirmatoryEchoWorklist = getAsyncLifecycle(
  () => import('./worklists/confirmatory-echo-worklist.component'),
  options,
);

export const flagWorklist = getAsyncLifecycle(() => import('./worklists/flag-worklist.component'), options);

export const waitingListWorklist = getAsyncLifecycle(
  () => import('./worklists/waiting-list-worklist.component'),
  options,
);

export const waitingListDashboardLink = getSyncLifecycle(waitingListDashboardLinkComponent, options);

export const waitingListDashboard = getAsyncLifecycle(() => import('./waiting-list/waiting-list.component'), options);

export const screenPositiveDashboardLink = getSyncLifecycle(screenPositiveDashboardLinkComponent, options);

export const screenPositiveDashboard = getAsyncLifecycle(
  () => import('./screen-positive/screen-positive.component'),
  options,
);

export const reportsDashboardLink = getSyncLifecycle(reportsDashboardLinkComponent, options);

export const reportsDashboard = getAsyncLifecycle(() => import('./programme-report/reports.component'), options);

export const reportViewDashboardLink = getSyncLifecycle(reportViewDashboardLinkComponent, options);

export const reportViewDashboard = getAsyncLifecycle(() => import('./report-view/report-view.component'), options);

export const facilityReportsDashboardLink = getSyncLifecycle(facilityReportsDashboardLinkComponent, options);

export const facilityReportsDashboard = getAsyncLifecycle(
  () => import('./programme-report/facility-reports.component'),
  options,
);

export const instanceAdminDashboardLink = getSyncLifecycle(instanceAdminDashboardLinkComponent, options);

export const instanceAdminDashboard = getAsyncLifecycle(
  () => import('./instance-admin/instance-admin-dashboard.component'),
  options,
);

export const usersDashboardLink = getAsyncLifecycle(() => import('./users/users-dashboard-link.component'), options);

export const usersDashboard = getAsyncLifecycle(() => import('./users/users.component'), options);

export const dashboardLink = getAsyncLifecycle(() => import('./dashboard/dashboard-link.component'), options);

export const dashboard = getAsyncLifecycle(() => import('./dashboard/dashboard.component'), options);

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

export const downloadDashboardLink = getAsyncLifecycle(
  () => import('./download/download-dashboard-link.component'),
  options,
);

export const downloadDashboard = getAsyncLifecycle(() => import('./download/download.component'), options);

export const logsDashboardLink = getAsyncLifecycle(() => import('./logs/logs-dashboard-link.component'), options);

export const logsDashboard = getAsyncLifecycle(() => import('./logs/logs.component'), options);

export const patientsOnProphylaxisDashboardLink = getSyncLifecycle(
  patientsOnProphylaxisDashboardLinkComponent,
  options,
);

export const patientsOnProphylaxisDashboard = getAsyncLifecycle(
  () => import('./enter-prophylaxis/patients-on-prophylaxis.component'),
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

export const instanceAdminNav = getAsyncLifecycle(
  () => import('./instance-admin/instance-admin-nav.component'),
  options,
);

export const communityHomeDashboard = getAsyncLifecycle(
  () => import('./community-home/community-home-dashboard.component'),
  options,
);

const quickActions = () => import('./quick-actions/quick-actions.component');

export const communityHomeQuickActions = getAsyncLifecycle(
  () => quickActions().then(({ CommunityHomeQuickActions }) => ({ default: CommunityHomeQuickActions })),
  options,
);

export const instanceAdminQuickActions = getAsyncLifecycle(
  () => quickActions().then(({ InstanceAdminQuickActions }) => ({ default: InstanceAdminQuickActions })),
  options,
);

export const instanceAdminKpis = getAsyncLifecycle(
  () =>
    import('./instance-admin/instance-admin-kpis.component').then(({ InstanceAdminKpis }) => ({
      default: InstanceAdminKpis,
    })),
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

export const formsAndSitesQuickAction = getAsyncLifecycle(
  () => quickActionTiles().then(({ FormsAndSitesAction }) => ({ default: FormsAndSitesAction })),
  options,
);

export const rolePermissionsQuickAction = getAsyncLifecycle(
  () => quickActionTiles().then(({ RolePermissionsAction }) => ({ default: RolePermissionsAction })),
  options,
);

export const researchParticipationQuickAction = getAsyncLifecycle(
  () => quickActionTiles().then(({ ResearchParticipationAction }) => ({ default: ResearchParticipationAction })),
  options,
);
