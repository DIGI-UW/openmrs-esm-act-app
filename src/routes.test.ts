import { describe, expect, it } from 'vitest';
import { evaluate } from '@openmrs/esm-expression-evaluator';
import routeFile from './routes.json';
import {
  PRIVILEGE_ACT_HOME,
  PRIVILEGE_DUE_LIST,
  PRIVILEGE_COMMUNITY_HOME,
  PRIVILEGE_DATA_CLERK,
  PRIVILEGE_REGISTRY,
  PRIVILEGE_REPORTS,
  PRIVILEGE_SCREEN_POSITIVE,
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
    ['act-admin-nav', screenPrivileges.home],
    ['act-reports-dashboard-link', screenPrivileges.reports],
    ['act-reports-dashboard', screenPrivileges.reports],
    ['act-facility-reports-dashboard-link', screenPrivileges.dataClerk],
    ['act-facility-reports-dashboard', screenPrivileges.dataClerk],
    ['act-studies-dashboard-link', 'Manage Locations'],
    ['act-studies-dashboard', 'Manage Locations'],
    ['act-refresh-flags-dashboard-link', 'Task: act.refreshFlags'],
    ['act-refresh-flags-dashboard', 'Task: act.refreshFlags'],
    ['act-home-due-for-prophylaxis', 'App: act.dueList'],
    ['act-next-steps-card', ['Get Encounters', 'Get Observations', 'Add Encounters']],
  ])("declares %s behind its screen's privilege", (name, privilege) => {
    expect(routes.extensions.find((extension) => extension.name === name)?.privileges).toEqual(privilege);
  });

  it.each([
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
        'act-worklist-waiting-list',
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

  it('declares a privilege on every extension, so none shows to every signed-in user', () => {
    expect(routes.extensions.filter((extension) => !('privileges' in extension)).map(({ name }) => name)).toEqual([]);
  });
});
