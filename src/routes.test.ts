import { describe, expect, it } from 'vitest';
import { evaluate } from '@openmrs/esm-expression-evaluator';
import routeFile from './routes.json';
import { inrTrendSlot } from './inr/inr-chart-control.component';
import {
  PRIVILEGE_ACT_HOME,
  PRIVILEGE_DASHBOARD,
  PRIVILEGE_DUE_LIST,
  PRIVILEGE_COMMUNITY_HOME,
  PRIVILEGE_DATA_CLERK,
  PRIVILEGE_ENTER_PROPHYLAXIS,
  PRIVILEGE_INSTANCE_ADMIN,
  PRIVILEGE_REGISTRY,
  PRIVILEGE_REPORTS,
  PRIVILEGE_SCREEN_POSITIVE,
  PRIVILEGE_STATUS_FLAGS,
  PRIVILEGE_WAITING_LIST,
  PRIVILEGE_WORKLISTS,
} from './constants';

const screenPrivileges = {
  home: PRIVILEGE_ACT_HOME,
  registry: PRIVILEGE_REGISTRY,
  worklists: PRIVILEGE_WORKLISTS,
  waitingList: PRIVILEGE_WAITING_LIST,
  screenPositive: PRIVILEGE_SCREEN_POSITIVE,
  dueList: PRIVILEGE_DUE_LIST,
  dataClerk: PRIVILEGE_DATA_CLERK,
  communityHome: PRIVILEGE_COMMUNITY_HOME,
  reports: PRIVILEGE_REPORTS,
  dashboard: PRIVILEGE_DASHBOARD,
  instanceAdmin: PRIVILEGE_INSTANCE_ADMIN,
};

const routes = routeFile as {
  extensions: Array<{
    name: string;
    slot?: string;
    order?: number;
    privileges?: string | Array<string>;
    displayExpression?: string;
  }>;
};

describe('routes.json privileges', () => {
  it.each([
    ['act-home-dashboard-link', screenPrivileges.home],
    ['act-home-dashboard', screenPrivileges.home],
    ['act-home-quick-actions', screenPrivileges.home],
    ['act-home-worklists', screenPrivileges.worklists],
    ['act-home-overdue-consultation', screenPrivileges.registry],
    ['act-home-care-cascade', screenPrivileges.registry],
    ['act-registry-dashboard-link', screenPrivileges.registry],
    ['act-registry-dashboard', screenPrivileges.registry],
    ['act-worklists-dashboard-link', screenPrivileges.worklists],
    ['act-worklists-dashboard', screenPrivileges.worklists],
    ['act-waiting-list-dashboard-link', screenPrivileges.waitingList],
    ['act-waiting-list-dashboard', screenPrivileges.waitingList],
    ['act-screen-positive-dashboard-link', screenPrivileges.screenPositive],
    ['act-screen-positive-dashboard', screenPrivileges.screenPositive],
    ['act-due-for-prophylaxis-dashboard-link', screenPrivileges.dueList],
    ['act-due-for-prophylaxis-dashboard', screenPrivileges.dueList],
    ['act-due-for-prophylaxis-widget', screenPrivileges.dueList],
    ['act-community-home-dashboard-link', screenPrivileges.communityHome],
    ['act-community-home-dashboard', screenPrivileges.communityHome],
    ['act-community-home-quick-actions', screenPrivileges.communityHome],
    ['act-community-home-record-bpg', 'Add Encounters'],
    ['act-community-home-record-oral', 'Add Encounters'],
    ['act-community-home-register-patient', 'Add Patients'],
    ['act-community-home-find-patient', 'Get Patients'],
    ['act-community-home-facility-report', screenPrivileges.dataClerk],
    ['act-home-register-patient', 'Add Patients'],
    ['act-home-enter-prophylaxis', ['Add Encounters', screenPrivileges.registry]],
    ['act-home-find-patient', 'Get Patients'],
    ['act-back-to-act-link', 'Get Patients'],
    ['act-reports-dashboard-link', screenPrivileges.reports],
    ['act-reports-dashboard', screenPrivileges.reports],
    ['act-report-dashboard-link', screenPrivileges.reports],
    ['act-report-dashboard', screenPrivileges.reports],
    ['act-run-charts-dashboard-link', screenPrivileges.dashboard],
    ['act-run-charts-dashboard', screenPrivileges.dashboard],
    ['act-dashboard-link', screenPrivileges.dashboard],
    ['act-dashboard', screenPrivileges.dashboard],
    ['act-facility-reports-dashboard-link', screenPrivileges.dataClerk],
    ['act-facility-reports-dashboard', screenPrivileges.dataClerk],
    ['act-instance-admin-dashboard-link', screenPrivileges.instanceAdmin],
    ['act-instance-admin-dashboard', screenPrivileges.instanceAdmin],
    ['act-instance-admin-quick-actions', screenPrivileges.instanceAdmin],
    ['act-instance-admin-kpis', screenPrivileges.instanceAdmin],
    ['act-instance-admin-forms-and-sites', screenPrivileges.instanceAdmin],
    ['act-instance-admin-role-permissions', screenPrivileges.instanceAdmin],
    ['act-instance-admin-research-participation', screenPrivileges.instanceAdmin],
    ['act-instance-admin-nav', screenPrivileges.instanceAdmin],
    ['act-studies-dashboard-link', 'App: act.studies'],
    ['act-studies-dashboard', 'App: act.studies'],
    ['act-research-dashboard-link', 'App: act.studies'],
    ['act-research-dashboard', 'App: act.studies'],
    ['act-refresh-flags-dashboard-link', 'Task: act.refreshFlags'],
    ['act-refresh-flags-dashboard', 'Task: act.refreshFlags'],
    ['act-home-due-for-prophylaxis', 'App: act.dueList'],
    ['act-next-steps-card', ['Get Encounters', 'Get Observations', 'Add Encounters']],
    ['act-patient-status-flags', [PRIVILEGE_STATUS_FLAGS, 'Get Encounters', 'Get Observations']],
    ['act-allergies-pill', ['Get Encounters', 'Get Observations']],
    ['act-consultation-inr-trend', ['Get Encounters', 'Get Observations']],
    // The roles that record BPG Delivery, whose form a scanned patient card opens.
    ['act-scan-patient-card-dashboard-link', PRIVILEGE_ENTER_PROPHYLAXIS],
    ['act-scan-patient-card-dashboard', PRIVILEGE_ENTER_PROPHYLAXIS],
  ])("declares %s behind its screen's privilege", (name, privilege) => {
    expect(routes.extensions.find((extension) => extension.name === name)?.privileges).toEqual(privilege);
  });

  it.each([
    [inrTrendSlot, ['act-consultation-inr-trend']],
    ['act-community-home-widgets-slot', ['act-community-home-quick-actions', 'act-due-for-prophylaxis-widget']],
    [
      'act-community-home-quick-actions-slot',
      [
        'act-community-home-record-bpg',
        'act-community-home-record-oral',
        'act-community-home-register-patient',
        'act-community-home-find-patient',
        'act-community-home-facility-report',
      ],
    ],
    [
      'act-home-quick-actions-slot',
      [
        'act-home-record-bpg',
        'act-home-record-oral',
        'act-home-register-patient',
        'act-home-enter-prophylaxis',
        'act-home-find-patient',
      ],
    ],
    [
      'rhd-home-widgets-slot',
      [
        'act-home-quick-actions',
        'act-home-due-for-prophylaxis',
        'act-home-worklists',
        'act-home-worklists-beside-cascade',
        'act-home-overdue-consultation',
        'act-home-care-cascade',
      ],
    ],
    [
      'act-worklists-slot',
      [
        'act-worklist-due-for-prophylaxis',
        'act-worklist-confirmatory-echo',
        'act-worklist-cardiology-follow-up',
        'act-worklist-lost-to-follow-up',
        'act-worklist-post-procedural-follow-up',
        'act-worklist-pregnancy-outcome',
        'act-worklist-inr-review',
        'act-worklist-referred-to-clinician',
        'act-worklist-waiting-list',
      ],
    ],
    ['act-instance-admin-widgets-slot', ['act-instance-admin-quick-actions', 'act-instance-admin-kpis']],
    [
      'act-instance-admin-quick-actions-slot',
      [
        'act-instance-admin-forms-and-sites',
        'act-instance-admin-role-permissions',
        'act-instance-admin-research-participation',
      ],
    ],
  ])("fills %s in the mockup's order", (slot, names) => {
    expect(
      routes.extensions
        .filter((extension) => extension.slot === slot)
        .sort((a, b) => a.order - b.order)
        .map(({ name }) => name),
    ).toEqual(names);
  });

  // Privileges cannot tell a community clinician from a site administrator, who must hold every privilege they give.
  it.each([
    ['act-home-record-bpg', true],
    ['act-home-record-oral', true],
    ['act-home-due-for-prophylaxis', true],
    ['act-home-worklists-beside-cascade', true],
    ['act-home-enter-prophylaxis', false],
    ['act-home-worklists', false],
    ['act-home-overdue-consultation', false],
    ['act-worklist-due-for-prophylaxis', undefined],
    ['act-worklist-confirmatory-echo', undefined],
    ['act-worklist-cardiology-follow-up', undefined],
    ['act-worklist-lost-to-follow-up', undefined],
    ['act-worklist-post-procedural-follow-up', false],
    ['act-worklist-pregnancy-outcome', false],
    ['act-worklist-inr-review', false],
    ['act-worklist-referred-to-clinician', false],
    ['act-worklist-waiting-list', false],
  ])('shows %s to a community clinician only (true), to everyone else (false), or by privilege alone', (name, cc) => {
    const expression = routes.extensions.find((extension) => extension.name === name)?.displayExpression;
    const roles = (display: string) => ({ session: { user: { roles: [{ display }] } } });
    if (cc === undefined) {
      expect(expression).toBeUndefined();
    } else {
      expect(evaluate(expression, roles('Organizational: ACT Community Clinician'))).toBe(cc);
      expect(evaluate(expression, roles('Organizational: ACT Site Administrator'))).toBe(!cc);
    }
  });

  it('adds one patient banner action, Update patient status, and its workspace; OpenMRS prints the identifier sticker itself', () => {
    expect(
      routes.extensions.filter((extension) => extension.slot === 'patient-actions-slot').map(({ name }) => name),
    ).toEqual(['act-update-patient-status']);
    expect(routeFile).not.toHaveProperty('modals');
    expect(routeFile.workspaces2).toContainEqual({
      name: 'act-update-patient-status-workspace',
      component: 'updatePatientStatusWorkspace',
      window: 'act-update-patient-status',
    });
    expect(routeFile.workspaceWindows2).toContainEqual({ name: 'act-update-patient-status', group: 'patient-chart' });
  });

  it('opens Update prophylaxis in a workspace of the patient chart', () => {
    expect(routeFile.workspaces2).toContainEqual({
      name: 'act-update-prophylaxis-workspace',
      component: 'updateProphylaxisWorkspace',
      window: 'act-update-prophylaxis',
    });
    expect(routeFile.workspaceWindows2).toContainEqual({ name: 'act-update-prophylaxis', group: 'patient-chart' });
  });

  it('shows Update patient status to a user who may edit programmes or people, or to a super user, and to no one else', () => {
    const expression = routes.extensions.find(
      (extension) => extension.name === 'act-update-patient-status',
    )?.displayExpression;
    const session = (privileges: Array<string>, roles: Array<string> = []) => ({
      session: {
        user: {
          privileges: privileges.map((display) => ({ display })),
          roles: roles.map((display) => ({ display })),
        },
      },
    });
    expect(evaluate(expression, session(['Edit Patient Programs']))).toBe(true);
    expect(evaluate(expression, session(['Edit People']))).toBe(true);
    expect(evaluate(expression, session([], ['System Developer']))).toBe(true);
    expect(evaluate(expression, session(['Get Patients']))).toBe(false);
  });

  it('declares a privilege on every extension but Download data, Logs, Update patient status, the Admin nav, the session timeout and the Help menu items Contact us and Docs, so none shows to every signed-in user', () => {
    // They gate themselves: Download data and Update patient status on either of two privileges, Logs on either audit
    // privilege, the Admin nav per link, the session timeout on being signed in, and the Help menu's items on being configured.
    expect(routes.extensions.filter((extension) => !('privileges' in extension)).map(({ name }) => name)).toEqual([
      'act-download-dashboard-link',
      'act-download-dashboard',
      'act-logs-dashboard-link',
      'act-logs-dashboard',
      'act-admin-nav',
      'act-session-timeout',
      'act-help-contact',
      'act-help-docs',
      'act-update-patient-status',
    ]);
  });

  it.each(['act-logs-dashboard-link', 'act-logs-dashboard'])(
    'shows %s to a user holding any of the three audit privileges, or to a super user, and to no one else',
    (name) => {
      const expression = routes.extensions.find((extension) => extension.name === name)?.displayExpression;
      const session = (privileges: Array<string>, roles: Array<string> = []) => ({
        session: {
          user: {
            privileges: privileges.map((display) => ({ display })),
            roles: roles.map((display) => ({ display })),
          },
        },
      });
      expect(evaluate(expression, session(['View Audit Logs']))).toBe(true);
      expect(evaluate(expression, session(['View Read Audit Logs']))).toBe(true);
      expect(evaluate(expression, session(['View Security Audit Logs']))).toBe(true);
      expect(evaluate(expression, session([], ['System Developer']))).toBe(true);
      expect(evaluate(expression, session(['App: act.home'], ['Organizational: ACT Clinician']))).toBe(false);
    },
  );
});

const workspaceRoutes = routeFile as unknown as {
  workspaceGroups2: Array<{ name: string; scopePattern: string }>;
  workspaceWindows2: Array<{ name: string; group: string }>;
  workspaces2: Array<{ name: string; component: string; window: string }>;
};

/** The patient chart app defines this group; an ACT window joins it, as O3's own chart windows do. */
const patientChartGroup = 'patient-chart';

describe('routes.json workspaces', () => {
  it('puts every workspace in an ACT window in a group, and names each only once', () => {
    const groups = workspaceRoutes.workspaceGroups2.map((group) => group.name);
    const windows = workspaceRoutes.workspaceWindows2.map((window) => window.name);
    expect(new Set(groups).size).toBe(groups.length);
    expect(new Set(windows).size).toBe(windows.length);
    workspaceRoutes.workspaceWindows2
      .filter((window) => window.group !== patientChartGroup)
      .forEach((window) => expect(groups).toContain(window.group));
    workspaceRoutes.workspaces2
      .filter((workspace) => workspace.window.startsWith('act-'))
      .forEach((workspace) => expect(windows).toContain(workspace.window));
  });

  it.each([
    ['act-clinic-form-workspace', 'act-clinics', '/home/act-clinics'],
    ['act-study-form-workspace', 'act-studies', '/home/act-studies'],
    ['act-user-form-workspace', 'act-users', '/home/act-users'],
    ['act-reset-password-workspace', 'act-users', '/home/act-users'],
  ])('opens %s in the %s group, scoped to the page %s', (name, group, page) => {
    const workspace = workspaceRoutes.workspaces2.find((candidate) => candidate.name === name);
    const window = workspaceRoutes.workspaceWindows2.find((candidate) => candidate.name === workspace?.window);
    const scope = workspaceRoutes.workspaceGroups2.find((candidate) => candidate.name === window?.group);
    expect(scope?.name).toBe(group);
    const pattern = new RegExp(scope.scopePattern);
    expect(pattern.test(page)).toBe(true);
    expect(pattern.test(`/openmrs/spa${page}`)).toBe(false);
  });

  it('opens the enrolment workspace in the patient chart group', () => {
    const workspace = workspaceRoutes.workspaces2.find((candidate) => candidate.name === 'act-enrollment-workspace');
    const window = workspaceRoutes.workspaceWindows2.find((candidate) => candidate.name === workspace?.window);
    expect(window?.group).toBe(patientChartGroup);
  });
});
